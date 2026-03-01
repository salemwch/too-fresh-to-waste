import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class UpdatePasswordDto {
    @ApiProperty({
        description: 'New password (min 8 chars, must contain uppercase, lowercase, number, special char)',
        example: 'NewSecure@123',
        minLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]/, {
        message: 'Password must contain uppercase, lowercase, number, and special character',
    })
    newPassword: string;
}
