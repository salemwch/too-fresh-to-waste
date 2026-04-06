import { Module } from '@nestjs/common';

import { EmailService } from './email.service';
import { EMAIL_SERVICE_TOKEN } from './interfaces';

/**
 * EmailModule
 *
 * Provides email services with interface-based dependency injection.
 * Supports both interface-based and concrete class injection for backward compatibility.
 */
@Module({
  providers: [
    // Enterprise pattern: Interface-based dependency injection
    {
      provide: EMAIL_SERVICE_TOKEN,
      useClass: EmailService,
    },
    // Keep concrete class for backward compatibility
    EmailService,
  ],
  exports: [
    EMAIL_SERVICE_TOKEN, // Export interface token for interface-based consumption
    EmailService, // Export concrete class for backward compatibility
  ],
})
export class EmailModule {}
