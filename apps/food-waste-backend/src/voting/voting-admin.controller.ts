import { UserRole } from '@foodwaste/shared';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';
import { VotingService } from './voting.service';

@ApiTags('Voting Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('voting/admin')
export class VotingAdminController {
  constructor(private readonly votingService: VotingService) {}

  @Get('cycles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all voting cycles (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of voting cycles' })
  async listCycles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const data = await this.votingService.listCycles(page, limit);
    return {
      status: 'success',
      message: 'Voting cycles retrieved',
      data: data.cycles,
      meta: { page, limit, total: data.total },
    };
  }

  @Post('cycles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new voting cycle' })
  @ApiResponse({ status: 201, description: 'Voting cycle created' })
  async createCycle(@Body() dto: CreateCycleDto, @GetUser('id') adminId: string) {
    const data = await this.votingService.createCycle(dto, adminId);
    return { status: 'success', message: 'Voting cycle created', data };
  }

  @Patch('cycles/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a voting cycle (field locking enforced)' })
  @ApiResponse({ status: 200, description: 'Voting cycle updated' })
  async updateCycle(@Param('id') id: string, @Body() dto: UpdateCycleDto) {
    const data = await this.votingService.updateCycle(id, dto);
    return { status: 'success', message: 'Voting cycle updated', data };
  }

  @Delete('cycles/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a DRAFT voting cycle' })
  @ApiResponse({ status: 200, description: 'Voting cycle deleted' })
  async deleteCycle(@Param('id') id: string) {
    await this.votingService.deleteCycle(id);
    return { status: 'success', message: 'Voting cycle deleted' };
  }

  @Post('cycles/:id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a DRAFT cycle (DRAFT → ACTIVE)' })
  @ApiResponse({ status: 200, description: 'Voting cycle activated' })
  async activateCycle(@Param('id') id: string, @GetUser('id') adminId: string) {
    const data = await this.votingService.activateCycle(id, adminId);
    return { status: 'success', message: 'Voting cycle activated', data };
  }

  @Post('cycles/:id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a COMPLETED or EXPIRED cycle' })
  @ApiResponse({ status: 200, description: 'Voting cycle archived' })
  async archiveCycle(@Param('id') id: string, @GetUser('id') adminId: string) {
    const data = await this.votingService.archiveCycle(id, adminId);
    return { status: 'success', message: 'Voting cycle archived', data };
  }

  @Get('cycles/:id/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get full cycle statistics' })
  @ApiResponse({ status: 200, description: 'Cycle statistics' })
  async getCycleStats(@Param('id') id: string) {
    const data = await this.votingService.getCycleStats(id);
    return { status: 'success', message: 'Cycle stats retrieved', data };
  }

  @Post('cycles/:id/tally')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manual tally (TALLYING only; no-op if COMPLETED)' })
  @ApiResponse({ status: 200, description: 'Tally completed' })
  async manualTally(@Param('id') id: string, @GetUser('id') adminId: string) {
    const data = await this.votingService.manualTally(id, adminId);
    return { status: 'success', message: 'Tally completed', data };
  }

  @Post('cycles/:id/retry-snapshot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry snapshot creation (BALLOT_OPEN + snapshotReady=false)' })
  @ApiResponse({ status: 200, description: 'Snapshot created' })
  async retrySnapshot(@Param('id') id: string, @GetUser('id') adminId: string) {
    const count = await this.votingService.retrySnapshot(id, adminId);
    return { status: 'success', message: `Snapshot created for ${count} users`, data: { count } };
  }
}
