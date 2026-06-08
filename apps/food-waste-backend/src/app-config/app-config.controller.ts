import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';

@ApiTags('Config')
@Controller('config')
export class AppConfigController {
  private readonly minVersion: string;
  private readonly latestVersion: string;
  private readonly updateUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.minVersion = this.configService.get<string>('MIN_APP_VERSION', '0.0.0');
    this.latestVersion = this.configService.get<string>('LATEST_APP_VERSION', '0.0.0');
    this.updateUrl = this.configService.get<string>(
      'APP_UPDATE_URL',
      'https://play.google.com/store/apps/details?id=com.toofreshtowaste.app',
    );
  }

  @Get('app-version')
  @Public()
  @ApiOperation({ summary: 'Get app version requirements for update checks' })
  getAppVersion() {
    return {
      status: 'success',
      message: 'App version config retrieved',
      data: {
        minVersion: this.minVersion,
        latestVersion: this.latestVersion,
        updateUrl: this.updateUrl,
      },
    };
  }
}
