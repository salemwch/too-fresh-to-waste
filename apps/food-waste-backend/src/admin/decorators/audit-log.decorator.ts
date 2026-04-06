import { SetMetadata } from '@nestjs/common';

import type { AdminAction } from '../interfaces/admin-analytics.interface';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  action: AdminAction;
  targetType: 'user' | 'establishment' | 'order' | 'review' | 'offer' | 'system';
  description?: string;
}

export const AuditLog = (metadata: AuditLogMetadata) => SetMetadata(AUDIT_LOG_KEY, metadata);
