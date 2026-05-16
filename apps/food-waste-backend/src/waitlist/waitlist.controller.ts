import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';

import { SubscribeWaitlistDto } from './dto/subscribe-waitlist.dto';
import { WaitlistService } from './waitlist.service';

@ApiTags('Waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Public()
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscribe to the app launch waitlist' })
  async subscribe(@Body() dto: SubscribeWaitlistDto): Promise<{ message: string }> {
    await this.waitlistService.subscribe(dto.email);
    return { message: "You're on the list! We'll notify you on launch day." };
  }
}
