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

  @Get('features')
  @Public()
  @ApiOperation({
    summary: 'Runtime feature flags',
    description:
      'Lets a shipped client turn a feature off without a store release. Clients must ' +
      'treat an unreachable endpoint as "off" for anything that takes money.',
  })
  getFeatures() {
    return {
      status: 'success',
      message: 'Feature flags retrieved',
      data: {
        onlinePayment: this.isEnabled('FEATURE_ONLINE_PAYMENT'),
      },
    };
  }

  /**
   * Read on every request rather than cached in the constructor like the version
   * fields above. A flag is a switch someone flips during an incident, so the
   * value must never be older than the process env.
   *
   * Default is `false`: a flag that fails to parse must not enable a payment
   * path. Set `FEATURE_ONLINE_PAYMENT=true` explicitly to turn it on.
   */
  private isEnabled(key: string): boolean {
    return this.configService.get<string>(key, 'false') === 'true';
  }
}
