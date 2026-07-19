import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsEnum, IsString, MaxLength, IsMongoId } from 'class-validator';

import { TicketStatus, TicketPriority, TicketCategory } from '../schemas/support-ticket.schema';

export class TicketSearchDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
  @ApiPropertyOptional({ enum: TicketCategory })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() assignedTo?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) limit?: number = 20;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: TicketStatus })
  @IsNotEmpty()
  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}

export class AssignTicketDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  assignedTo!: string;
}

export class UpdateTicketPriorityDto {
  @ApiProperty({ enum: TicketPriority })
  @IsNotEmpty()
  @IsEnum(TicketPriority)
  priority!: TicketPriority;
}

export class ReplyToTicketDto {
  @ApiProperty({ maxLength: 5000 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  message!: string;
}
