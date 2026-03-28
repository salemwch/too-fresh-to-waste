import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ProcessRefundDto {
  @IsNotEmpty()
  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsNotEmpty()
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
