import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

import { CastVoteDto } from './dto/cast-vote.dto';
import { VotingService } from './voting.service';

@ApiTags('Voting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('voting')
export class VotingController {
  constructor(private readonly votingService: VotingService) {}

  @Get('active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get active voting cycle with eligibility and vote status' })
  @ApiResponse({ status: 200, description: 'Active cycle data (or null if no active cycle)' })
  async getActiveCycle(@GetUser('id') userId: string) {
    const data = await this.votingService.getActiveCycle(userId);
    return { status: 'success', message: 'Active voting cycle retrieved', data };
  }

  @Post('vote')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Cast a vote for a prize' })
  @ApiResponse({ status: 201, description: 'Vote cast successfully' })
  @ApiResponse({ status: 400, description: 'Ballot not open / invalid prize' })
  @ApiResponse({ status: 403, description: 'Not eligible' })
  @ApiResponse({ status: 409, description: 'Already voted / snapshot not ready' })
  async castVote(@GetUser('id') userId: string, @Body() dto: CastVoteDto) {
    const vote = await this.votingService.castVote(userId, dto);
    return { status: 'success', message: 'Vote cast successfully', data: vote };
  }

  @Get('results')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Get voting results (vote-first-to-see during BALLOT_OPEN)' })
  @ApiResponse({ status: 200, description: 'Voting results' })
  @ApiResponse({ status: 403, description: 'Must vote first to see results' })
  async getResults(@GetUser('id') userId: string, @Query('cycleId') cycleId?: string) {
    const data = await this.votingService.getResults(userId, cycleId);
    return { status: 'success', message: 'Voting results retrieved', data };
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get past completed voting cycles' })
  @ApiResponse({ status: 200, description: 'Past cycles list' })
  async getHistory() {
    const data = await this.votingService.getHistory();
    return { status: 'success', message: 'Voting history retrieved', data };
  }
}
