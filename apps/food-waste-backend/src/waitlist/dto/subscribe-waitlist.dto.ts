import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class SubscribeWaitlistDto {
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
