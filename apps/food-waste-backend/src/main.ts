import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import express from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AppLoggerService } from './common/services/logger.service';
import { TransformInterceptor } from './common/interceptors/transFormInterceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { PrometheusMetricsService } from './common/services/prometheus-metrics.service';
import { RedisIoAdapter } from './websocket/adapters/redis-io.adapter';

async function bootstrap() {
    const configService = new ConfigService();
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    const environment = configService.get<string>('NODE_ENV') || 'development';

    // ============================================================================
    // SENTRY INITIALIZATION (MUST BE FIRST)
    // Initialize Sentry as early as possible to catch all errors
    // ============================================================================
    const sentryDsn = configService.get<string>('SENTRY_DSN');
    if (sentryDsn) {
        Sentry.init({
            dsn: sentryDsn,
            environment,
            release: `foodwaste-backend@${configService.get('npm_package_version') || '1.0.0'}`,

            // Performance monitoring
            tracesSampleRate: isProduction ? 0.1 : 1.0,

            // Only enable in production and staging
            enabled: environment !== 'development' && environment !== 'test',

            // Integrations
            integrations: [
                Sentry.httpIntegration(),
                Sentry.mongoIntegration(),
                Sentry.mongooseIntegration(),
            ],

            // Filter sensitive data
            beforeSend: (event) => {
                // Remove sensitive environment variables
                if (event.contexts?.runtime?.env) {
                    const sensitiveKeys = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_PASSWORD'];
                    sensitiveKeys.forEach((key) => {
                        if (event.contexts!.runtime!.env![key]) {
                            event.contexts!.runtime!.env![key] = '[REDACTED]';
                        }
                    });
                }
                return event;
            },
        });

        console.log(`[Sentry] Initialized for environment: ${environment}`);
    }

    const logger = new AppLoggerService();

    let app;
    const enableHttps = configService.get<string>('ENABLE_HTTPS') === 'true';
    if (isProduction || enableHttps) {
        try {
            const httpsOptions = {
                key: readFileSync(
                    configService.get<string>('SSL_KEY_PATH') ||
                    join(__dirname, '..', 'certs', 'server.key')
                ),
                cert: readFileSync(
                    configService.get<string>('SSL_CERT_PATH') ||
                    join(__dirname, '..', 'certs', 'server.cert')
                ),
            };
            app = await NestFactory.create(AppModule, { httpsOptions });
            } catch (err) {
            logger.security(`HTTPS certificates not found, falling back to HTTP: ${(err as Error).message}`);
            app = await NestFactory.create(AppModule);
        }
    } else {
        app = await NestFactory.create(AppModule);
    }

    const appConfigService = app.get(ConfigService);
    const metricsService = app.get(PrometheusMetricsService);

    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalInterceptors(new RequestLoggingInterceptor());
    app.useGlobalInterceptors(new MetricsInterceptor(metricsService));

    /**
     * ENTERPRISE-GRADE API VERSIONING
     * Strategy: URI Versioning (most common in REST APIs)
     * Format: /api/v1/users, /api/v2/users
     *
     * @rationale URI versioning is explicit, discoverable, and cacheable
     * @see https://docs.nestjs.com/techniques/versioning
     */
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
        prefix: 'api/v',
    });

    /**
     * ENTERPRISE-GRADE SECURITY HEADERS (FAANG-Level CSP Configuration)
     * Using Helmet.js with comprehensive Content Security Policy
     *
     * @rationale Multi-layered defense against XSS, clickjacking, data injection, and MITM attacks
     * @compliance OWASP Top 10, CWE-79, CWE-1021, CWE-693
     *
     * CSP Directives Implemented:
     * - defaultSrc: Fallback for unspecified directives
     * - scriptSrc/styleSrc: Prevent inline script/style injection (production)
     * - objectSrc: Block Flash, Java, and other plugins (attack vector)
     * - mediaSrc: Control audio/video sources
     * - workerSrc: Restrict Web Workers and Service Workers
     * - manifestSrc: Control PWA manifest loading
     * - formAction: Prevent form submission to untrusted domains
     * - frameAncestors: Modern alternative to X-Frame-Options (clickjacking)
     * - baseUri: Prevent <base> tag injection
     * - upgradeInsecureRequests: Force all HTTP to HTTPS
     * - reportUri: CSP violation reporting for monitoring
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
     * @see https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
     */
    app.use(helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: isProduction ? {
            // PRODUCTION: Strict CSP without unsafe-inline
            directives: {
                defaultSrc: [`'self'`],
                scriptSrc: [`'self'`],                           // No unsafe-inline in production
                styleSrc: [`'self'`],                            // No unsafe-inline in production
                imgSrc: [`'self'`, 'data:', 'https:'],          // Allow data URIs and HTTPS images
                fontSrc: [`'self'`, 'data:'],                    // Web fonts
                connectSrc: [`'self'`],                          // XHR, WebSocket, EventSource
                objectSrc: [`'none'`],                           // Block plugins (Flash, Java, ActiveX)
                mediaSrc: [`'self'`],                            // Audio/video sources
                workerSrc: [`'self'`],                           // Web Workers, Service Workers
                manifestSrc: [`'self'`],                         // PWA manifest
                childSrc: [`'none'`],                            // Deprecated but supported by older browsers
                formAction: [`'self'`],                          // Restrict form submission targets
                frameAncestors: [`'none'`],                      // Prevent clickjacking (alternative to X-Frame-Options)
                baseUri: [`'self'`],                             // Prevent <base> tag injection
                upgradeInsecureRequests: [],                     // Force HTTPS upgrade for all requests
                reportUri: ['/api/v1/csp-report'],              // CSP violation reporting endpoint
            },
        } : {
            // DEVELOPMENT: Relaxed CSP for Swagger UI compatibility
            // Swagger requires unsafe-inline for its embedded scripts and styles
            directives: {
                defaultSrc: [`'self'`],
                scriptSrc: [`'self'`, `'unsafe-inline'`],       // Required for Swagger UI
                styleSrc: [`'self'`, `'unsafe-inline'`],        // Required for Swagger UI
                imgSrc: [`'self'`, 'data:', 'https:', 'validator.swagger.io'],
                fontSrc: [`'self'`, 'data:'],
                connectSrc: [`'self'`],
                objectSrc: [`'none'`],                           // Block plugins even in dev
                mediaSrc: [`'self'`],
                workerSrc: [`'self'`],
                manifestSrc: [`'self'`],
                childSrc: [`'none'`],
                formAction: [`'self'`],
                frameAncestors: [`'none'`],
                baseUri: [`'self'`],
                reportUri: ['/api/v1/csp-report'],              // CSP violation reporting (enabled in dev for testing)
                // NOTE: upgradeInsecureRequests intentionally OMITTED in dev
                // — it forces HTTP→HTTPS which breaks local IP/localhost dev servers
            },
        },
        // HTTP Strict Transport Security (HSTS)
        // Forces browsers to use HTTPS for all future requests
        // DISABLED in development — breaks local HTTP dev servers
        hsts: isProduction ? {
            maxAge: 31536000,       // 1 year (OWASP recommended minimum)
            includeSubDomains: true, // Apply to all subdomains
            preload: true,           // Eligible for browser HSTS preload list
        } : false,
        // X-Frame-Options: Defense-in-depth (CSP frame-ancestors is primary)
        frameguard: {
            action: 'deny',          // Prevent iframe embedding completely
        },
        // X-Content-Type-Options: nosniff
        // Prevents MIME sniffing attacks
        noSniff: true,
        // X-XSS-Protection: 1; mode=block (legacy, CSP is primary)
        xssFilter: true,
        // Referrer-Policy: Control referrer information leakage
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin',
        },
        // Permissions Policy (formerly Feature-Policy)
        // Note: Helmet doesn't directly support this, handled in SecurityMiddleware
    }));

    app.use(compression());

    /**
     * SECURE COOKIE PARSER
     * Configures cookie security attributes globally
     *
     * CRITICAL: Secret is required for signed cookies (session cookies use signed: true)
     * @see https://expressjs.com/en/resources/middleware/cookie-parser.html
     */
    const cookieSecret = configService.get<string>('COOKIE_SECRET') || configService.get<string>('JWT_SECRET');
    if (!cookieSecret) {
        console.warn('[Security] COOKIE_SECRET not configured - using fallback. Set COOKIE_SECRET in production.');
    }
    app.use(cookieParser(cookieSecret));

    /**
     * STATIC FILE SERVING
     * Serve static assets (images, etc.) for email templates and user uploads
     * Path: /public/images/leaf.png
     * Path: /uploads/establishments/image.jpg
     *
     * Note: __dirname in compiled code is dist/src/, so we need to go up 2 levels
     */
    app.use('/public', express.static(join(__dirname, '../..', 'public')));

    // Legacy static uploads route — backward compatibility for existing DB URLs
    // New uploads go to Firebase Cloud Storage; this serves old local files only
    app.use('/uploads', (req, res, next) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        next();
    }, express.static(join(__dirname, '../..', 'uploads')));

    /**
     * MIDDLEWARE EXECUTION ORDER (Critical for Security):
     * 1. GlobalSanitizationMiddleware (from AppModule.configure) - sanitizes ALL input
     * 2. Helmet - security headers
     * 3. CORS - cross-origin validation
     * 4. ValidationPipe - validates sanitized data
     * 5. Business logic
     *
     * @rationale Sanitize BEFORE validation to prevent XSS bypassing validation
     */
    app.enableCors({
        origin: [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:8081',
            'http://10.0.2.2:3000',
            'http://10.0.2.2:8081',
            'http://127.0.0.1:8081',
            'http://192.168.1.6:3000',
            'null',
            // ngrok domains - Add your ngrok URL pattern
            /^https:\/\/[a-z0-9-]+\.ngrok\.app$/,
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    });
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: (errors) => new BadRequestException(errors),
            disableErrorMessages: appConfigService.get('NODE_ENV') === 'production',
        }),
    );

    /**
     * ENTERPRISE-GRADE SWAGGER/OpenAPI DOCUMENTATION
     *
     * Features:
     * - Comprehensive API documentation with examples
     * - Multiple authentication schemes (Bearer JWT, API Key)
     * - Standardized error responses
     * - Request/response examples
     * - Schema validation documentation
     *
     * @see https://docs.nestjs.com/openapi/introduction
     * @see https://swagger.io/specification/
     */
    const config = new DocumentBuilder()
        .setTitle('Food Waste API')
        .setDescription(
            `**Enterprise-grade API for Food Waste Reduction Platform**

This API provides comprehensive endpoints for:
- 🔐 **Authentication & Authorization**: JWT-based auth with MFA support
- 👥 **User Management**: Consumer and establishment profiles
- 🏪 **Establishments**: Restaurant and merchant management
- 🎁 **Offers**: Surplus food listings and reservations
- 📦 **Orders**: Order processing and fulfillment
- ⭐ **Reviews**: Rating and review system
- 📍 **Geolocation**: Location-based search and proximity matching
- 🔔 **Notifications**: Real-time alerts and messaging
- 💳 **Payments**: Payment processing and refunds
- 📊 **Analytics**: Business intelligence and reporting
- 🎯 **Loyalty**: Rewards and gamification

**Base URL**: \`${process.env.API_BASE_URL || 'http://localhost:3000'}\`

**Versioning**: All endpoints use URI versioning (\`/api/v1/...\`)

**Rate Limiting**:
- Authentication endpoints: 5 requests/5min
- Public endpoints: 50 requests/1min
- Authenticated endpoints: 200 requests/1min

**Support**: support@foodwaste.app
`,
        )
        .setVersion('1.0.0')
        .setContact(
            'Food Waste Platform Team',
            'https://foodwaste.app',
            'support@foodwaste.app',
        )
        .setLicense('Proprietary', 'https://foodwaste.app/license')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                name: 'JWT',
                description: 'Enter JWT access token',
                in: 'header',
            },
            'JWT-auth', // Security scheme ID
        )
        .addApiKey(
            {
                type: 'apiKey',
                name: 'X-API-Key',
                in: 'header',
                description: 'API Key for service-to-service authentication',
            },
            'API-Key',
        )
        .addServer('http://localhost:3000', 'Local Development')
        .addServer('https://staging-api.foodwaste.app', 'Staging Environment')
        .addServer('https://api.foodwaste.app', 'Production')
        .addTag('Authentication', 'User authentication and authorization endpoints')
        .addTag('Users', 'User profile and preferences management')
        .addTag('Establishments', 'Restaurant and merchant management')
        .addTag('Offers', 'Surplus food offers and listings')
        .addTag('Orders', 'Order creation and management')
        .addTag('Reviews', 'Review and rating system')
        .addTag('Favorites', 'User favorites and bookmarks')
        .addTag('Geolocation', 'Location-based services and search')
        .addTag('Notifications', 'Push notifications and alerts')
        .addTag('Payments', 'Payment processing')
        .addTag('Loyalty', 'Loyalty program and rewards')
        .addTag('Analytics', 'Business analytics and reporting')
        .addTag('Admin', 'Administrative operations (admin only)')
        .addTag('Search', 'Global search functionality')
        .addTag('Social', 'Social features and community')
        .addTag('Donations', 'Food donation features')
        .addTag('Inventory', 'Inventory management')
        .addTag('Moderation', 'Content moderation')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/api-docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true, // Persist auth between page refreshes
            tagsSorter: 'alpha', // Sort tags alphabetically
            operationsSorter: 'alpha', // Sort operations alphabetically
            docExpansion: 'none', // Collapse all sections by default
            filter: true, // Enable search filter
            showRequestDuration: true, // Show request duration in Try it out
            tryItOutEnabled: true, // Enable Try it out by default
        },
        customSiteTitle: 'Food Waste API Documentation',
        customfavIcon: '/favicon.ico',
        customCss: `
            .swagger-ui .topbar { display: none }
            .swagger-ui .info .title { color: #2c3e50; }
        `,
    });

    const port = appConfigService.get('PORT') || 3000;
    const protocol = (isProduction || enableHttps) ? 'HTTPS' : 'HTTP';

    // Enable shutdown hooks for proper lifecycle management
    app.enableShutdownHooks();

    // ========================================================================
    // REDIS IO ADAPTER — enables WebSocket horizontal scaling
    // Socket.IO events are synced across instances via Redis pub/sub.
    // Without this, multi-instance deployments drop WebSocket messages.
    // ========================================================================
    const redisIoAdapter = new RedisIoAdapter(app, appConfigService);
    try {
        await redisIoAdapter.connectToRedis();
        app.useWebSocketAdapter(redisIoAdapter);
        logger.startup('Redis IO adapter enabled for WebSocket horizontal scaling');
    } catch (err) {
        logger.security(
            `Redis IO adapter failed — falling back to in-memory adapter (single-instance only): ${(err as Error).message}`,
        );
    }

    await app.listen(port, '0.0.0.0');
    logger.startup(`Food Waste API running on ${protocol} port ${port}`, {
        port,
        protocol,
        environment,
        sentryEnabled: !!sentryDsn,
    });

    process.on('SIGTERM', async () => {
        try {
            logger.shutdown('SIGTERM received, shutting down gracefully...');

            // Flush Sentry events before shutdown
            if (sentryDsn) {
                await Sentry.close(2000);
            }

            await app.close();
            process.exit(0);
        } catch (error) {
            logger.error('Error during SIGTERM shutdown:', error);
            process.exit(1);
        }
    });

    process.on('SIGINT', async () => {
        try {
            logger.shutdown('SIGINT received, shutting down gracefully...');

            // Flush Sentry events before shutdown
            if (sentryDsn) {
                await Sentry.close(2000);
            }

            await app.close();
            process.exit(0);
        } catch (error) {
            logger.error('Error during SIGINT shutdown:', error);
            process.exit(1);
        }
    });

}
bootstrap().catch(async (error) => {
    const logger = new AppLoggerService();
    const errorId = logger.error(`Failed to start the application: ${error.message}`, error.stack, 'Bootstrap');

    console.error(`[Bootstrap Error] Error ID: ${errorId}`);

    // Ensure Sentry captures bootstrap errors
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(error, {
            tags: { errorId },
            contexts: {
                bootstrap: {
                    errorId,
                    message: error.message,
                },
            },
        });
        await Sentry.close(2000).then(() => {
            process.exit(1);
        });
    } else {
        process.exit(1);
    }
});