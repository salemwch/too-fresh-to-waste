import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class SMTWebhookPayloadDto {
    @IsNotEmpty()
    @IsString()
    @IsOptional()
    transactionId?: string;

    @IsNotEmpty()
    @IsString()
    merchantTransactionId: string;

    @IsNotEmpty()
    @IsString()
    status: string;

    @IsNotEmpty()
    @IsString()
    responseCode: string;

    @IsNotEmpty()
    @IsString()
    responseMessage: string;

    @IsOptional()
    @IsString()
    authorizationCode?: string;

    @IsOptional()
    @IsString()
    rrn?: string;

    @IsNotEmpty()
    @IsString()
    timestamp: string;

    @IsNotEmpty()
    @IsString()
    signature: string;

    @IsOptional()
    @IsNumber()
    amount?: number;

    @IsOptional()
    @IsString()
    currency?: string;
}
