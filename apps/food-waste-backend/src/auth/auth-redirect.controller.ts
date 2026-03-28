import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';

/**
 * AuthRedirectController
 * Handles email verification and password reset redirects
 *
 * Purpose: Email clients block custom URI schemes (foodwaste://)
 * Solution: Use HTTPS links that redirect to deep links or web UI
 *
 * Flow:
 * 1. User clicks HTTPS link in email
 * 2. Backend serves HTML page with JavaScript
 * 3. JavaScript attempts deep link (opens app if installed)
 * 4. Falls back to web UI or instructions after 2 seconds
 *
 * Used by: Uber, Airbnb, Instagram, Slack, etc.
 */
@ApiTags('auth-redirect')
@Controller('auth')
export class AuthRedirectController {
  private readonly logger = new Logger(AuthRedirectController.name);

  constructor(private readonly configService: ConfigService) {}

  @Get('verify-email')
  @ApiOperation({ summary: 'Email verification redirect handler' })
  @ApiQuery({ name: 'token', required: true, description: 'Email verification token' })
  @ApiQuery({ name: 'email', required: true, description: 'User email address' })
  verifyEmailRedirect(
    @Query('token') token: string,
    @Query('email') email: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Email verification redirect accessed for: ${email}`);

    // Deep link for mobile app
    const deepLink = `foodwaste://auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    // Web frontend callback URL (verify-callback page handles POST + auto-login)
    const webFrontendUrl = this.configService.get<string>('WEB_FRONTEND_URL', '');
    const webCallbackUrl = webFrontendUrl
      ? `${webFrontendUrl}/verify-callback?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
      : '';

    const html = this.generateSmartRedirectPage(deepLink, webCallbackUrl, token, email);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('reset-password')
  @ApiOperation({ summary: 'Password reset redirect handler' })
  @ApiQuery({ name: 'token', required: true, description: 'Password reset token' })
  @ApiQuery({ name: 'email', required: true, description: 'User email address' })
  resetPasswordRedirect(
    @Query('token') token: string,
    @Query('email') email: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Password reset redirect accessed for: ${email}`);

    const deepLink = `foodwaste://auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    const webFallbackUrl = `${this.configService.get<string>('WEB_FRONTEND_URL', 'https://yourapp.com')}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    const html = this.generatePasswordResetRedirectPage(deepLink, webFallbackUrl, token, email);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * Generate smart redirect page
   * Attempts deep link first (for mobile), then auto-redirects to web callback.
   * Flow: deep link attempt → 1.5s timeout → redirect to web verify-callback page
   */
  private generateSmartRedirectPage(
    deepLink: string,
    webCallbackUrl: string,
    _token: string,
    _email: string,
  ): string {
    const webBtnHtml = webCallbackUrl
      ? `<a href="${webCallbackUrl}" class="btn" style="background:#e5e7eb;color:#333;">Verify in Browser</a>`
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification - Too Fresh To Waste</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.08);
            text-align: center;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #22c55e;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        h1 { color: #333; font-size: 22px; margin-bottom: 12px; }
        p { color: #666; font-size: 14px; line-height: 1.5; }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 8px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            border: none;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .btn-primary {
            background: #22c55e;
            color: white;
        }
        #fallback-actions { display: none; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h1>Verifying your email...</h1>
        <p>Redirecting you automatically. Please wait.</p>

        <div id="fallback-actions">
            <p style="margin-bottom: 12px; color: #999;">If nothing happened, try one of these:</p>
            <a href="${deepLink}" class="btn btn-primary">Open in App</a>
            ${webBtnHtml}
        </div>
    </div>

    <script>
        var DEEP_LINK = '${deepLink}';
        var WEB_CALLBACK = '${webCallbackUrl}';
        var DEEP_LINK_TIMEOUT = 1500;

        // Track if user leaves page (deep link succeeded)
        var pageHidden = false;
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) pageHidden = true;
        });

        // 1. Attempt deep link first (for mobile)
        setTimeout(function() {
            window.location.href = DEEP_LINK;
        }, 100);

        // 2. After timeout: if page is still visible, redirect to web callback
        setTimeout(function() {
            if (pageHidden) return; // App opened successfully, do nothing

            if (WEB_CALLBACK) {
                // Auto-redirect to web verify-callback page
                window.location.href = WEB_CALLBACK;
            } else {
                // No web frontend configured — show manual actions
                document.getElementById('fallback-actions').style.display = 'block';
            }
        }, DEEP_LINK_TIMEOUT);
    </script>
</body>
</html>
        `;
  }

  private generatePasswordResetRedirectPage(
    deepLink: string,
    webFallbackUrl: string,
    _token: string,
    _email: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Too Fresh To Waste</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.08);
            text-align: center;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #dc3545;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        h1 { color: #333; font-size: 22px; margin-bottom: 12px; }
        p { color: #666; font-size: 14px; line-height: 1.5; }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 8px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            border: none;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .btn-primary {
            background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
            color: white;
        }
        #fallback-actions { display: none; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h1>Opening password reset...</h1>
        <p>Redirecting you automatically. Please wait.</p>

        <div id="fallback-actions">
            <p style="margin-bottom: 12px; color: #999;">If nothing happened, try one of these:</p>
            <a href="${deepLink}" class="btn btn-primary">Open in App</a>
            <a href="${webFallbackUrl}" class="btn" style="background:#e5e7eb;color:#333;">Reset in Browser</a>
        </div>
    </div>

    <script>
        var DEEP_LINK = '${deepLink}';
        var WEB_FALLBACK = '${webFallbackUrl}';
        var DEEP_LINK_TIMEOUT = 1500;

        // Track if user leaves page (deep link succeeded)
        var pageHidden = false;
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) pageHidden = true;
        });

        // 1. Attempt deep link first (for mobile)
        setTimeout(function() {
            window.location.href = DEEP_LINK;
        }, 100);

        // 2. After timeout: if page is still visible, show fallback actions
        setTimeout(function() {
            if (pageHidden) return; // App opened successfully, do nothing
            document.getElementById('fallback-actions').style.display = 'block';
        }, DEEP_LINK_TIMEOUT);
    </script>
</body>
</html>
        `;
  }
}
