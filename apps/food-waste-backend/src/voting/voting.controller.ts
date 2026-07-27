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
import { UserRole } from '@foodwaste/shared';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

import { CastVoteDto } from './dto/cast-vote.dto';
import { VotingPrizeService } from './services/voting-prize.service';
import { VotingService } from './voting.service';

@ApiTags('Voting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('voting')
export class VotingController {
  constructor(
    private readonly votingService: VotingService,
    private readonly votingPrizeService: VotingPrizeService,
  ) {}

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

  @Get('my-prize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER)
  @ApiOperation({ summary: 'Check if the user won the latest completed voting cycle prize' })
  @ApiResponse({ status: 200, description: 'Voting prize status for the current user' })
  async getMyPrize(@GetUser('id') userId: string) {
    const data = await this.votingPrizeService.getMyPrize(userId);
    return { status: 'success', message: 'Voting prize status retrieved', data };
  }

  @Post('claim-prize')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard, ThrottlerGuard)
  @Roles(UserRole.CONSUMER)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Claim the grand prize the community voted for',
    description:
      'Open to the top `recipientCount` of the leaderboard, whoever they voted for. The grand prize is a physical item delivered by an admin, so no establishment is chosen — that applies to the discount every other participant receives.',
  })
  @ApiResponse({ status: 201, description: 'Grand prize claimed' })
  @ApiResponse({ status: 400, description: 'Not a winner / no completed cycle' })
  @ApiResponse({ status: 409, description: 'Already claimed' })
  async claimPrize(@GetUser('id') userId: string) {
    const data = await this.votingPrizeService.claimPrize(userId);
    return { status: 'success', message: 'Voting prize claimed', data };
  }
}
