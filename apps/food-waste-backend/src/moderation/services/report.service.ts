import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument, ReportStatus, ReportPriority } from '../schemas/report.schema';
import { CreateReportDto } from '../dtos/create-report.dto';
import { ReportQueryDto, ReportUpdateDto } from '../dtos/report-query.dto';
import { ModerationLogService } from './moderation-log.service';
import { LogLevel, LogCategory } from '../schemas/moderation-log.schema';
import { UserRole } from '../../common/enums/user.enum';

@Injectable()
export class ReportService {
    constructor(
        @InjectModel(Report.name)
        private readonly reportModel: Model<ReportDocument>,
        private readonly moderationLogService: ModerationLogService
    ) { }

    async createReport(
        createReportDto: CreateReportDto,
        reporterId: string,
        requestContext?: { ipAddress?: string; userAgent?: string; endpoint?: string }
    ): Promise<ReportDocument> {
        // Check for duplicate reports within 24 hours
        const existingReport = await this.reportModel.findOne({
            reporterId: new Types.ObjectId(reporterId),
            targetId: new Types.ObjectId(createReportDto.targetId),
            type: createReportDto.type,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (existingReport) {
            throw new BadRequestException('You have already reported this content within the last 24 hours');
        }

        // Auto-prioritize based on reason
        const priority = this.determinePriority(createReportDto.reason);

        const report = new this.reportModel({
            ...createReportDto,
            reporterId: new Types.ObjectId(reporterId),
            targetId: new Types.ObjectId(createReportDto.targetId),
            priority,
            status: ReportStatus.PENDING,
            moderationHistory: [{
                action: 'created',
                performedBy: new Types.ObjectId(reporterId),
                details: 'Report created',
                timestamp: new Date()
            }]
        });

        const savedReport = await report.save();

        // Log the report creation
        await this.moderationLogService.logModerationEvent({
            level: priority === ReportPriority.CRITICAL ? LogLevel.CRITICAL : LogLevel.INFO,
            category: LogCategory.REPORT_HANDLING,
            action: 'REPORT_CREATED',
            description: `New report created for ${createReportDto.type}: ${createReportDto.reason}`,
            performedBy: reporterId,
            targetId: createReportDto.targetId,
            targetType: createReportDto.type,
            relatedReportId: savedReport._id.toString(),
            requestContext,
            metadata: { priority, reason: createReportDto.reason }
        });

        return savedReport;
    }

    /**
     * Get reports with filtering and pagination, respecting user permissions
     */
    async getReports(
        queryDto: ReportQueryDto,
        currentUserId: string,
        userRole: UserRole
    ): Promise<{ reports: ReportDocument[]; total: number; totalPages: number }> {
        const query: any = {};

        // Build query based on filters
        if (queryDto.type) { query.type = queryDto.type; }
        if (queryDto.reason) { query.reason = queryDto.reason; }
        if (queryDto.status) { query.status = queryDto.status; }
        if (queryDto.priority) { query.priority = queryDto.priority; }
        if (queryDto.reporterId) { query.reporterId = new Types.ObjectId(queryDto.reporterId); }

        // Role-based access control
        if (userRole === UserRole.MODERATOR) {
            // Moderators can only see unassigned reports or reports assigned to them
            query.$or = [
                { assignedToModerator: new Types.ObjectId(currentUserId) },
                { assignedToModerator: { $exists: false } },
                { assignedToModerator: null }
            ];
        }
        // Admins can see all reports (no additional filter)

        // Date range filter
        if (queryDto.startDate || queryDto.endDate) {
            query.createdAt = {};
            if (queryDto.startDate) { query.createdAt.$gte = new Date(queryDto.startDate); }
            if (queryDto.endDate) { query.createdAt.$lte = new Date(queryDto.endDate); }
        }

        // Search functionality
        if (queryDto.search) {
            query.$or = [
                { description: { $regex: queryDto.search, $options: 'i' } },
                { resolutionNotes: { $regex: queryDto.search, $options: 'i' } }
            ];
        }

        const skip = (queryDto.page - 1) * queryDto.limit;
        const sortOrder: 1 | -1 = queryDto.sortOrder === 'asc' ? 1 : -1;
        const sort = { [queryDto.sortBy]: sortOrder };

        const [reports, total] = await Promise.all([
            this.reportModel
                .find(query)
                .populate('reporterId', 'firstName lastName email')
                .populate('assignedToModerator', 'firstName lastName email')
                .populate('resolvedBy', 'firstName lastName email')
                .sort(sort)
                .skip(skip)
                .limit(queryDto.limit)
                .exec(),
            this.reportModel.countDocuments(query)
        ]);

        return {
            reports,
            total,
            totalPages: Math.ceil(total / queryDto.limit)
        };
    }

    /**
     * Get a specific report by ID with permission checks
     */
    async getReportById(
        reportId: string,
        currentUserId: string,
        userRole: UserRole
    ): Promise<ReportDocument> {
        const report = await this.reportModel
            .findById(reportId)
            .populate('reporterId', 'firstName lastName email')
            .populate('assignedToModerator', 'firstName lastName email')
            .populate('resolvedBy', 'firstName lastName email')
            .populate('moderationHistory.performedBy', 'firstName lastName email')
            .exec();

        if (!report) {
            throw new NotFoundException('Report not found');
        }

        // Permission check for moderators
        if (userRole === UserRole.MODERATOR &&
            report.assignedToModerator &&
            !report.assignedToModerator._id.equals(currentUserId)) {
            throw new ForbiddenException('You can only access reports assigned to you');
        }

        return report;
    }

    /**
     * Update report with audit logging
     */
    async updateReport(
        reportId: string,
        updateDto: ReportUpdateDto,
        currentUserId: string,
        userRole: UserRole,
        requestContext?: { ipAddress?: string; userAgent?: string }
    ): Promise<ReportDocument> {
        const report = await this.getReportById(reportId, currentUserId, userRole);

        const beforeState = {
            status: report.status,
            priority: report.priority,
            assignedToModerator: report.assignedToModerator?._id?.toString(),
            resolutionNotes: report.resolutionNotes
        };

        // Update fields
        if (updateDto.status !== undefined) {
            report.status = updateDto.status;

            if (updateDto.status === ReportStatus.RESOLVED) {
                report.resolvedBy = new Types.ObjectId(currentUserId);
                report.resolvedAt = new Date();
            }
        }

        if (updateDto.priority !== undefined) {
            report.priority = updateDto.priority;
        }

        if (updateDto.assignedToModerator !== undefined) {
            report.assignedToModerator = updateDto.assignedToModerator ?
                new Types.ObjectId(updateDto.assignedToModerator) : null;
        }

        if (updateDto.resolutionNotes !== undefined) {
            report.resolutionNotes = updateDto.resolutionNotes;
        }

        // Add to moderation history
        report.moderationHistory.push({
            action: 'updated',
            performedBy: new Types.ObjectId(currentUserId),
            details: `Report updated: ${Object.keys(updateDto).join(', ')}`,
            timestamp: new Date()
        });

        const updatedReport = await report.save();

        const afterState = {
            status: updatedReport.status,
            priority: updatedReport.priority,
            assignedToModerator: updatedReport.assignedToModerator?.toString(),
            resolutionNotes: updatedReport.resolutionNotes
        };

        // Log the update
        await this.moderationLogService.logModerationEvent({
            level: LogLevel.INFO,
            category: LogCategory.REPORT_HANDLING,
            action: 'REPORT_UPDATED',
            description: `Report ${reportId} updated`,
            performedBy: currentUserId,
            targetId: updatedReport.targetId.toString(),
            targetType: updatedReport.type,
            relatedReportId: reportId,
            requestContext,
            beforeState,
            afterState,
            metadata: updateDto
        });

        return updatedReport;
    }

    /**
     * Assign report to moderator (admin only)
     */
    async assignReport(
        reportId: string,
        moderatorId: string,
        assignedBy: string,
        requestContext?: { ipAddress?: string; userAgent?: string }
    ): Promise<ReportDocument> {
        const report = await this.reportModel.findById(reportId);

        if (!report) {
            throw new NotFoundException('Report not found');
        }

        const previousModerator = report.assignedToModerator;
        report.assignedToModerator = new Types.ObjectId(moderatorId);
        report.status = ReportStatus.IN_REVIEW;

        report.moderationHistory.push({
            action: 'assignment',
            performedBy: new Types.ObjectId(assignedBy),
            details: `Assigned to moderator ${moderatorId}`,
            timestamp: new Date()
        });

        const updatedReport = await report.save();

        // Log the assignment
        await this.moderationLogService.logModerationEvent({
            level: LogLevel.INFO,
            category: LogCategory.REPORT_HANDLING,
            action: 'REPORT_ASSIGNED',
            description: `Report assigned to moderator`,
            performedBy: assignedBy,
            targetId: report.targetId.toString(),
            targetType: report.type,
            relatedReportId: reportId,
            requestContext,
            beforeState: { assignedToModerator: previousModerator?.toString() },
            afterState: { assignedToModerator: moderatorId },
            metadata: { moderatorId }
        });

        return updatedReport;
    }

    /**
     * Get reports assigned to a specific moderator
     */
    getMyAssignedReports(
        moderatorId: string,
        status?: ReportStatus
    ): Promise<ReportDocument[]> {
        const query: any = { assignedToModerator: new Types.ObjectId(moderatorId) };

        if (status) {
            query.status = status;
        }

        return this.reportModel
            .find(query)
            .populate('reporterId', 'firstName lastName email')
            .sort({ priority: -1, createdAt: -1 })
            .exec();
    }

    /**
     * Get dashboard statistics for moderation team
     */
    async getDashboardStats(
        moderatorId?: string,
        userRole?: UserRole
    ): Promise<{
        total: number;
        pending: number;
        inReview: number;
        resolved: number;
        byPriority: Record<string, number>;
        byType: Record<string, number>;
        assignedToMe?: number;
    }> {
        const baseQuery = userRole === UserRole.MODERATOR && moderatorId ?
            { assignedToModerator: new Types.ObjectId(moderatorId) } : {};

        const [
            total,
            pending,
            inReview,
            resolved,
            byPriority,
            byType,
            assignedToMe
        ] = await Promise.all([
            this.reportModel.countDocuments(baseQuery),
            this.reportModel.countDocuments({ ...baseQuery, status: ReportStatus.PENDING }),
            this.reportModel.countDocuments({ ...baseQuery, status: ReportStatus.IN_REVIEW }),
            this.reportModel.countDocuments({ ...baseQuery, status: ReportStatus.RESOLVED }),

            this.reportModel.aggregate([
                { $match: baseQuery },
                { $group: { _id: '$priority', count: { $sum: 1 } } }
            ]),

            this.reportModel.aggregate([
                { $match: baseQuery },
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ]),

            moderatorId ? this.reportModel.countDocuments({
                assignedToModerator: new Types.ObjectId(moderatorId)
            }) : Promise.resolve(0)
        ]);

        const priorityStats = byPriority.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        const typeStats = byType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        const stats: any = {
            total,
            pending,
            inReview,
            resolved,
            byPriority: priorityStats,
            byType: typeStats
        };

        if (moderatorId) {
            stats.assignedToMe = assignedToMe;
        }

        return stats;
    }

    /**
     * Auto-determine priority based on report reason
     */
    private determinePriority(reason: string): ReportPriority {
        const criticalReasons = ['health_safety', 'fraud'];
        const highReasons = ['harassment', 'inappropriate_content'];
        const mediumReasons = ['spam', 'fake_profile', 'violation_of_terms'];

        if (criticalReasons.includes(reason)) {
            return ReportPriority.CRITICAL;
        } else if (highReasons.includes(reason)) {
            return ReportPriority.HIGH;
        } else if (mediumReasons.includes(reason)) {
            return ReportPriority.MEDIUM;
        } else {
            return ReportPriority.LOW;
        }
    }
}