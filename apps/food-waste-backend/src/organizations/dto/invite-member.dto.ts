import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsMongoId } from 'class-validator';

import { SanitizeEmail } from '../../common/decorators/sanitize.decorator';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email of the person to invite as location manager',
    example: 'receptionist@movenpick.tn',
  })
  @SanitizeEmail()
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Establishment ID to assign the manager to',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  assignedEstablishmentId!: string;
}
