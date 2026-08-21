import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';

import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { PublicService } from './public.service';
import { WaitlistAudience } from './schemas/city-waitlist-entry.schema';

/**
 * Unauthenticated, aggregate-only endpoints for the marketing site.
 *
 * Everything here is identical for every visitor and contains no personal data:
 * counts, not rows. Nothing that identifies a person may be added to these
 * responses — they are cached as one shared entry for everyone.
 */
@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Public()
  @Get('impact')
  @ApiOperation({
    summary: 'Platform impact totals',
    description:
      'Bags and meals rescued, active partners, CO₂ avoided, and how many people are on the platform. Cached for five minutes and identical for every caller.',
  })
  @ApiResponse({ status: 200, description: 'Impact totals retrieved' })
  async getImpact() {
    return {
      message: 'Impact retrieved successfully',
      data: await this.publicService.getImpact(),
    };
  }

  @Public()
  @Get('geozones')
  @ApiOperation({
    summary: 'Public rollout map',
    description:
      'Cities we serve or are opening next. Live first, then the city unlocking next, then everything queued ranked by how many people are waiting for it.',
  })
  @ApiResponse({ status: 200, description: 'Rollout map retrieved' })
  async getZones() {
    return {
      message: 'Rollout map retrieved successfully',
      data: await this.publicService.getZones(),
    };
  }

  @Public()
  @Post('waitlist')
  @HttpCode(HttpStatus.CREATED)
  // Anonymous write endpoint: tighter than the global limit so one client
  // cannot inflate a city's ranking by looping the form.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Join a city waiting list',
    description:
      'Adds an address to one city. Signing up again is treated as success rather than an error, so the response never reveals whether an address was already on the list.',
  })
  @ApiResponse({ status: 201, description: 'Added to the waiting list' })
  async joinWaitlist(@Body() dto: JoinWaitlistDto) {
    await this.publicService.joinWaitlist(
      dto.email,
      dto.zone,
      dto.audience ?? WaitlistAudience.CONSUMER,
    );

    return { message: 'You are on the list. We will email you the day your city opens.' };
  }
}
