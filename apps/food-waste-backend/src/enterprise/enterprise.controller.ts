import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';

import { CreateEnterpriseInquiryDto } from './dto/create-enterprise-inquiry.dto';
import { EnterpriseService } from './enterprise.service';

@ApiTags('Enterprise')
@Controller('enterprise')
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  @Public()
  @Post('inquiry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an enterprise partnership inquiry' })
  async createInquiry(@Body() dto: CreateEnterpriseInquiryDto): Promise<{ message: string }> {
    await this.enterpriseService.createInquiry(dto);
    return { message: 'Thanks! Our enterprise team will reach out within 24 hours.' };
  }
}
