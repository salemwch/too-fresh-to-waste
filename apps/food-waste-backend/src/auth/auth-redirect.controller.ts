import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

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
    async verifyEmailRedirect(
        @Query('token') token: string,
        @Query('email') email: string,
        @Res() res: Response,
    ) {
        this.logger.log(`Email verification redirect accessed for: ${email}`);

        // Deep link for mobile app
        const deepLink = `foodwaste://auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

        // API endpoint for web fallback (direct verification)
        const apiVerifyUrl = `${this.configService.get<string>('BACKEND_URL', 'http://localhost:3000')}/api/v1/auth/verify-email`;

        const html = this.generateSmartRedirectPage(deepLink, apiVerifyUrl, token, email);

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }

    @Get('reset-password')
    @ApiOperation({ summary: 'Password reset redirect handler' })
    @ApiQuery({ name: 'token', required: true, description: 'Password reset token' })
    @ApiQuery({ name: 'email', required: true, description: 'User email address' })
    async resetPasswordRedirect(
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
     * Attempts deep link, then falls back to API or web UI
     */
    private generateSmartRedirectPage(
        deepLink: string,
        apiVerifyUrl: string,
        token: string,
        email: string,
    ): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification - FoodWaste</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        }
        .logo {
            font-size: 48px;
            margin-bottom: 16px;
        }
        h1 {
            color: #333;
            font-size: 24px;
            margin-bottom: 16px;
        }
        .status {
            padding: 16px;
            border-radius: 8px;
            margin: 24px 0;
            font-size: 14px;
        }
        .status.loading {
            background: #e3f2fd;
            color: #1976d2;
        }
        .status.success {
            background: #e8f5e9;
            color: #2e7d32;
        }
        .status.error {
            background: #ffebee;
            color: #c62828;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
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
        .btn {
            display: inline-block;
            padding: 14px 28px;
            margin: 8px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .btn-secondary {
            background: #e0e0e0;
            color: #333;
        }
        .instructions {
            margin-top: 24px;
            padding: 16px;
            background: #f5f5f5;
            border-radius: 8px;
            font-size: 14px;
            color: #666;
            text-align: left;
        }
        .instructions ol {
            margin: 12px 0 12px 20px;
        }
        .instructions li {
            margin: 8px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🍽️</div>
        <h1>Email Verification</h1>

        <div id="status" class="status loading">
            <div class="spinner"></div>
            <p>Opening FoodWaste app...</p>
        </div>

        <div id="actions" style="display:none;">
            <a href="${deepLink}" class="btn btn-primary" id="openApp">
                📱 Open in App
            </a>
            <button onclick="verifyInBrowser()" class="btn btn-secondary" id="verifyBrowser">
                🌐 Verify in Browser
            </button>
        </div>

        <div class="instructions">
            <strong>📌 Don't have the app?</strong>
            <ol>
                <li>Download FoodWaste from the App Store or Play Store</li>
                <li>Open the app and register with: <strong>${email}</strong></li>
                <li>Your email will be verified automatically</li>
            </ol>
        </div>
    </div>

    <script>
        // Configuration
        const DEEP_LINK = '${deepLink}';
        const API_VERIFY_URL = '${apiVerifyUrl}';
        const TOKEN = '${token}';
        const EMAIL = '${email}';
        const APP_CHECK_TIMEOUT = 2000; // 2 seconds

        // Attempt to open app immediately
        window.location.href = DEEP_LINK;

        // After timeout, show manual options
        setTimeout(() => {
            const status = document.getElementById('status');
            const actions = document.getElementById('actions');

            status.style.display = 'none';
            actions.style.display = 'block';
        }, APP_CHECK_TIMEOUT);

        // Browser verification fallback
        async function verifyInBrowser() {
            const status = document.getElementById('status');
            const actions = document.getElementById('actions');

            status.className = 'status loading';
            status.innerHTML = '<div class="spinner"></div><p>Verifying your email...</p>';
            status.style.display = 'block';
            actions.style.display = 'none';

            try {
                const response = await fetch(API_VERIFY_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        token: TOKEN,
                        email: EMAIL
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    status.className = 'status success';
                    status.innerHTML = \`
                        <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
                        <strong>Email Verified!</strong>
                        <p style="margin-top: 8px;">Your account is now active. You can close this page and log in to the app.</p>
                    \`;
                } else {
                    throw new Error(result.message || 'Verification failed');
                }
            } catch (error) {
                status.className = 'status error';
                status.innerHTML = \`
                    <div style="font-size: 48px; margin-bottom: 12px;">❌</div>
                    <strong>Verification Failed</strong>
                    <p style="margin-top: 8px;">\${error.message}</p>
                    <p style="margin-top: 8px;">Please try again or contact support.</p>
                \`;
                actions.style.display = 'block';
            }
        }

        // Log analytics (optional)
        console.log('Email verification page loaded for:', EMAIL);
    </script>
</body>
</html>
        `;
    }

    private generatePasswordResetRedirectPage(
        deepLink: string,
        webFallbackUrl: string,
        token: string,
        email: string,
    ): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - FoodWaste</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
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
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        }
        .logo { font-size: 48px; margin-bottom: 16px; }
        h1 { color: #333; font-size: 24px; margin-bottom: 16px; }
        .btn {
            display: inline-block;
            padding: 14px 28px;
            margin: 8px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s;
        }
        .btn:hover { transform: translateY(-2px); }
        .btn-primary {
            background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
            color: white;
        }
        .btn-secondary { background: #e0e0e0; color: #333; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🔐</div>
        <h1>Reset Your Password</h1>
        <p style="margin: 20px 0; color: #666;">Choose how to reset your password:</p>

        <a href="${deepLink}" class="btn btn-primary">
            📱 Open in App
        </a>
        <a href="${webFallbackUrl}" class="btn btn-secondary">
            🌐 Reset in Browser
        </a>
    </div>
    <script>
        // Attempt to open app immediately
        window.location.href = '${deepLink}';
    </script>
</body>
</html>
        `;
    }
}
