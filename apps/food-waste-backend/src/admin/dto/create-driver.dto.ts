import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsString()
  @Length(8, 8, { message: 'Tunisian CIN must be exactly 8 digits' })
  @Matches(/^\d{8}$/, { message: 'CIN must contain only digits' })
  idCardNumber!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;
}
