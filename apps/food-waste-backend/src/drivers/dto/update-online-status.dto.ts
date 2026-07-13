import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateOnlineStatusDto {
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return value;
  })
  isOnline!: boolean;
}
