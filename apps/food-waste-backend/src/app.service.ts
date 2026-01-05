import { Controller, Get } from '@nestjs/common';
import { EmailService } from './email/email.service';

@Controller('test')
export class AppController {
    constructor(private readonly emailService: EmailService) { }
    @Get('send-email')
    async sendTestEmail() {
        const success = await this.emailService.sendEmail({
            to: 'salemwachwacha1997@gmail.com',
            subject: 'Test Email from FoodWaste App',
            text: 'Hello! This is a test email to verify SMTP.',
            html: '<p>Hello! This is a <strong>test email</strong> to verify SMTP.</p>',
        });
        return {
            success,
            message: success ? 'Email sent successfully!' : 'Failed to send email',
        };
    }
}
