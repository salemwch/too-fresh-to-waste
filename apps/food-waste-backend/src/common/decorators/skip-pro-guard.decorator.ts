import { SetMetadata } from '@nestjs/common';

export const SKIP_PRO_GUARD_KEY = 'skipProGuard';
export const SkipProGuard = () => SetMetadata(SKIP_PRO_GUARD_KEY, true);
