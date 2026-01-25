# Enterprise-Grade Logging and Monitoring Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Winston Logging](#winston-logging)
4. [Sentry Error Tracking](#sentry-error-tracking)
5. [Correlation IDs](#correlation-ids)
6. [Request Logging](#request-logging)
7. [Usage Examples](#usage-examples)
8. [Configuration](#configuration)
9. [Production Best Practices](#production-best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Food Waste Backend implements an enterprise-grade logging and monitoring infrastructure with:

### Key Features

- **✅ Structured JSON Logging** - Winston-based logging with JSON format for log aggregators (ELK, Splunk, Datadog)
- **✅ Error ID Generation** - Unique error IDs for cross-system tracking and customer support
- **✅ Correlation ID Tracking** - Distributed tracing across microservices and requests
- **✅ Real-time Error Tracking** - Sentry integration for production error monitoring and alerting
- **✅ Performance Monitoring** - Request/response timing, memory usage, and slow query detection
- **✅ Daily Log Rotation** - Automatic log file rotation with compression and retention policies
- **✅ PII Protection** - Automatic redaction of sensitive data (passwords, tokens, PII)
- **✅ Security Event Logging** - Dedicated logging for authentication, authorization, and security events
- **✅ Multiple Transports** - Console (development) and file (production) logging
- **✅ Context Enrichment** - User, request, and environment context in all logs

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Code                        │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              AppLoggerService (Winston)                      │
│  • Structured JSON logging                                   │
│  • Error ID generation                                       │
│  • Correlation ID tracking                                   │
│  • PII redaction                                             │
│  • Sentry integration (critical errors)                      │
└─────┬───────────────────────────────────┬───────────────────┘
      │                                   │
      ▼                                   ▼
┌─────────────────┐              ┌──────────────────┐
│  Winston Files  │              │  Sentry Cloud    │
│  • Rotating     │              │  • Real-time     │
│  • Compressed   │              │  • Alerts        │
│  • Retention    │              │  • Dashboards    │
└─────────────────┘              └──────────────────┘
```

### Middleware Stack

```
Request → CorrelationIdMiddleware
       → GlobalSanitizationMiddleware
       → RequestLoggingInterceptor
       → Controllers
       → AllExceptionsFilter (on error)
       → Response
```

---

## Winston Logging

### AppLoggerService

The central logging service using Winston with enterprise features.

**Location:** `src/common/services/logger.service.ts`

### Log Levels

| Level    | Priority | Use Case | Production |
|----------|----------|----------|------------|
| `error`  | 0        | Critical errors requiring immediate attention | ✅ |
| `warn`   | 1        | Warnings, potential issues | ✅ |
| `info`   | 2        | General application flow | ✅ |
| `http`   | 3        | HTTP request/response | ✅ |
| `verbose`| 4        | Detailed information | ❌ |
| `debug`  | 5        | Debug information | ❌ |
| `silly`  | 6        | Extremely detailed | ❌ |

### Log Outputs

#### Development
- **Console:** Colored, human-readable format
- **Files:** Disabled

#### Production
- **Console:** JSON format (for container log collection)
- **Files:** Daily rotating files with compression
  - `logs/application-YYYY-MM-DD.log` - All logs (14 days retention)
  - `logs/error-YYYY-MM-DD.log` - Error logs only (30 days retention)

### Features

#### 1. Error ID Generation
Every error gets a unique ID for tracking:
```
ERR-1638360000000-A1B2C3D4
└─┬┘ └──────┬───────┘ └──┬───┘
  │         │              └── Random UUID (8 chars)
  │         └─────────────── Timestamp
  └───────────────────────── Prefix
```

#### 2. Correlation ID Support
Track requests across distributed systems:
```typescript
logger.error('Payment failed', error, 'PaymentService', {
  correlationId: req.correlationId,
  userId: user.id,
  amount: 50.00
});
```

#### 3. Stack Trace Sanitization
Production stack traces are sanitized to prevent path leakage:
```
Before: at processPayment (C:\Users\Admin\foodwaste\src\payment\service.ts:123)
After:  at processPayment (service.ts:123)
```

#### 4. Structured Metadata
All logs include structured metadata for easy filtering:
```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "level": "error",
  "message": "Payment processing failed",
  "context": "PaymentService",
  "errorId": "ERR-1638360000000-A1B2C3D4",
  "correlationId": "req-abc123",
  "userId": "user_123",
  "environment": "production",
  "metadata": {
    "amount": 50.00,
    "paymentMethod": "card"
  }
}
```

---

## Sentry Error Tracking

### Overview

Sentry provides real-time error tracking, performance monitoring, and alerting for production issues.

**Website:** https://sentry.io

### Setup

1. **Create Sentry Project**
   - Sign up at https://sentry.io
   - Create a new Node.js project
   - Copy your DSN (Data Source Name)

2. **Configure Environment Variables**
   ```bash
   SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
   SENTRY_ENVIRONMENT=production
   SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
   ```

3. **Verification**
   - Start the application
   - Look for: `[Sentry] Initialized for environment: production`

### Features

#### 1. Automatic Error Capture
All errors logged via `AppLoggerService.error()` are automatically sent to Sentry:

```typescript
try {
  await processPayment(order);
} catch (error) {
  // Logged to Winston AND sent to Sentry
  const errorId = logger.error('Payment failed', error, 'PaymentService', {
    userId: user.id,
    orderId: order.id
  });
}
```

#### 2. Error Context Enrichment
Sentry errors include:
- **Error ID** - Links to Winston logs
- **Correlation ID** - Distributed tracing
- **User Context** - User ID, email, role
- **Request Context** - URL, method, headers (sanitized)
- **Custom Tags** - For filtering in dashboard

#### 3. PII Protection
Sensitive data is automatically redacted before sending to Sentry:
- Passwords
- Tokens and API keys
- Credit card numbers
- Personal information
- Environment variables (DATABASE_URL, JWT_SECRET, etc.)

#### 4. Performance Monitoring
Sentry tracks:
- HTTP request duration
- Database query performance
- External API call latency
- Memory usage

#### 5. Alerting
Configure alerts for:
- Error rate spikes
- New error types
- Performance degradation
- User-impacting errors

### Sentry Dashboard

Access your Sentry dashboard to:
- **View errors** - Real-time error stream
- **Assign issues** - Assign to team members
- **Set priorities** - Critical, high, medium, low
- **Track releases** - Link errors to deployments
- **View breadcrumbs** - See user actions before error

---

## Correlation IDs

### Purpose

Correlation IDs enable tracking requests across:
- Multiple microservices
- Log aggregators
- External systems
- Support tickets

### Middleware

**Location:** `src/common/middleware/correlation-id.middleware.ts`

### Flow

```
Client Request
  ↓
  X-Correlation-ID: req-abc123 (if provided by client)
  ↓
CorrelationIdMiddleware
  ↓
  Generate UUID if not provided
  ↓
  Attach to req.correlationId
  ↓
  Set response header: X-Correlation-ID
  ↓
All logs include correlationId
  ↓
Response to Client (includes X-Correlation-ID header)
```

### Usage

#### In Controllers
```typescript
@Get(':id')
async getOrder(@Param('id') orderId: string, @Req() req: Request) {
  this.logger.log('Fetching order', 'OrderController', {
    correlationId: req.correlationId,
    orderId
  });
}
```

#### In Services
```typescript
async processOrder(orderId: string, correlationId: string) {
  this.logger.log('Processing order', 'OrderService', {
    correlationId,
    orderId
  });
}
```

#### Client Usage
Clients can provide correlation IDs for tracking:
```bash
curl -H "X-Correlation-ID: mobile-app-req-123" \
     https://api.foodwaste.com/orders/456
```

### Benefits

- **End-to-end tracing** - Track requests across services
- **Debugging** - Find all logs related to a specific request
- **Support tickets** - Reference correlation ID for faster resolution
- **Performance analysis** - Identify slow requests

---

## Request Logging

### RequestLoggingInterceptor

Automatically logs all HTTP requests and responses.

**Location:** `src/common/interceptors/request-logging.interceptor.ts`

### Logged Information

#### Incoming Requests
```json
{
  "level": "http",
  "message": "→ POST /api/v1/orders",
  "correlationId": "req-abc123",
  "userId": "user_123",
  "method": "POST",
  "path": "/api/v1/orders",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "query": { "status": "pending" }
}
```

#### Successful Responses
```json
{
  "level": "http",
  "message": "✓ POST /api/v1/orders 201 - 145ms",
  "statusCode": 201,
  "duration": 145,
  "memoryUsageMB": 85,
  "contentLength": 1234
}
```

#### Error Responses
```json
{
  "level": "error",
  "message": "✗ POST /api/v1/orders 400 - Bad Request",
  "statusCode": 400,
  "errorName": "BadRequestException",
  "duration": 23
}
```

### Performance Alerts

Slow requests (>3 seconds) trigger performance logs:
```json
{
  "level": "warn",
  "message": "⚡ Slow request: GET /api/v1/orders",
  "duration": 3542,
  "path": "/api/v1/orders"
}
```

### PII Redaction

Sensitive data is automatically redacted:
- Request body passwords
- Authorization headers
- API keys
- Personal information

---

## Usage Examples

### Basic Logging

```typescript
import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '@common/services/logger.service';

@Injectable()
export class OrderService {
  private readonly logger = new AppLoggerService('OrderService');

  async createOrder(data: CreateOrderDto) {
    // Info log
    this.logger.log('Creating order', 'OrderService', {
      userId: data.userId,
      items: data.items.length
    });

    try {
      const order = await this.orderRepo.create(data);

      // Success log
      this.logger.log('Order created successfully', 'OrderService', {
        orderId: order.id
      });

      return order;
    } catch (error) {
      // Error log (sent to Sentry)
      const errorId = this.logger.error(
        'Failed to create order',
        error,
        'OrderService',
        {
          userId: data.userId
        }
      );

      throw new InternalServerErrorException({
        message: 'Order creation failed',
        errorId  // Return to client for support
      });
    }
  }
}
```

### Specialized Logging Methods

```typescript
// Security events (authentication, authorization)
this.logger.security('Failed login attempt', {
  email: 'user@example.com',
  ip: req.ip,
  attempts: 3
});

// Performance metrics
const startTime = Date.now();
await expensiveOperation();
const duration = Date.now() - startTime;
this.logger.performance('Expensive operation completed', duration, {
  operation: 'dataSync'
});

// Database operations
this.logger.database('Query executed', {
  collection: 'orders',
  query: { status: 'pending' },
  duration: 45
});

// External API calls
this.logger.external('Stripe payment processed', {
  provider: 'stripe',
  amount: 50.00,
  status: 'succeeded'
});

// Business events
this.logger.business('Order completed', {
  orderId: order.id,
  revenue: 50.00,
  establishmentId: establishment.id
});
```

### Correlation ID Tracking

```typescript
@Post()
async createOrder(
  @Body() data: CreateOrderDto,
  @Req() req: Request
) {
  const correlationId = req.correlationId;

  // Pass correlation ID through service layers
  await this.orderService.create(data, correlationId);
  await this.paymentService.process(order.id, correlationId);
  await this.notificationService.send(user.id, correlationId);
}

// In services
async create(data: CreateOrderDto, correlationId: string) {
  this.logger.log('Creating order', 'OrderService', {
    correlationId,
    userId: data.userId
  });
}
```

### Error Handling with Sentry

```typescript
try {
  await riskyOperation();
} catch (error) {
  // Log error (automatically sent to Sentry)
  const errorId = this.logger.error(
    'Operation failed',
    error,
    'ServiceName',
    {
      correlationId: req.correlationId,
      userId: user.id,
      operation: 'riskyOperation'
    }
  );

  // Return error ID to client
  throw new InternalServerErrorException({
    message: 'Operation failed. Please contact support.',
    errorId  // Client can reference this in support ticket
  });
}
```

---

## Configuration

### Environment Variables

```bash
# Winston Logging
LOG_LEVEL=info                    # Log level (debug, info, warn, error)
LOGS_DIR=./logs                   # Log file directory (production)

# Sentry Error Tracking
SENTRY_DSN=https://...            # Sentry project DSN
SENTRY_ENVIRONMENT=production     # Environment identifier
SENTRY_RELEASE=v1.2.3            # Release version
SENTRY_TRACES_SAMPLE_RATE=0.1    # Performance monitoring (0.0-1.0)
SENTRY_PROFILES_SAMPLE_RATE=0.1  # CPU profiling (0.0-1.0)
SERVER_NAME=api-server-01        # Server identifier (optional)
```

### Log Levels by Environment

| Environment  | LOG_LEVEL | Sentry Enabled | File Logs |
|--------------|-----------|----------------|-----------|
| Development  | `debug`   | ❌             | ❌        |
| Staging      | `info`    | ✅             | ✅        |
| Production   | `info`    | ✅             | ✅        |
| Test         | `error`   | ❌             | ❌        |

### Sentry Sample Rates

| Environment  | Traces | Profiles | Rationale |
|--------------|--------|----------|-----------|
| Production   | 10%    | 10%      | Cost optimization, sufficient data |
| Staging      | 50%    | 50%      | Better debugging, lower traffic |
| Development  | 100%   | 0%       | Full visibility, no profiling overhead |

---

## Production Best Practices

### 1. Log Retention Policy

| Log Type      | Retention | Location | Compression |
|---------------|-----------|----------|-------------|
| Application   | 14 days   | `logs/application-*.log` | ✅ |
| Errors        | 30 days   | `logs/error-*.log` | ✅ |
| Critical      | 90 days   | `logs/critical-*.log` | ✅ |

### 2. Log Aggregation

Centralize logs using:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Splunk**
- **Datadog**
- **AWS CloudWatch**
- **Azure Monitor**

Ship logs from Docker containers:
```yaml
# docker-compose.yml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 3. Sentry Configuration

#### Production
- Enable Sentry (`SENTRY_DSN` set)
- Low sample rate (10%) to control costs
- Set up alerts for critical errors
- Configure release tracking

#### Staging
- Enable Sentry for testing
- Higher sample rate (50%)
- Test alert configurations

#### Development
- Disable Sentry (no DSN)
- Use console logs for immediate feedback

### 4. PII Protection

**Always redact:**
- Passwords
- Tokens and API keys
- Credit card numbers
- Social security numbers
- Email addresses (in some contexts)
- Phone numbers (in some contexts)

**Implemented in:**
- `AppLoggerService` - Automatic redaction
- `RequestLoggingInterceptor` - Request/response sanitization
- `AllExceptionsFilter` - Error context sanitization
- `SentryService` - Sentry event filtering

### 5. Error ID Management

**Best practices:**
- Return error IDs to clients
- Include in support tickets
- Cross-reference in logs and Sentry
- Document format: `ERR-{timestamp}-{uuid}`

**Example client response:**
```json
{
  "statusCode": 500,
  "message": "Internal server error. Please contact support.",
  "errorId": "ERR-1638360000000-A1B2C3D4",
  "correlationId": "req-abc123",
  "timestamp": "2025-01-15T10:30:45.123Z"
}
```

### 6. Monitoring Dashboards

**Winston Logs:**
- Error rate by service
- Response time percentiles
- Request volume by endpoint
- Error breakdown by type

**Sentry:**
- Error frequency and trends
- User-impacting errors
- Performance bottlenecks
- Release health

### 7. Alerting

**Critical alerts:**
- Error rate > 1% of requests
- 5xx errors on critical endpoints
- Database connection failures
- Payment processing errors
- Authentication service outages

**Warning alerts:**
- Slow requests (>3 seconds)
- High memory usage
- Elevated error rate
- API rate limit approaching

---

## Troubleshooting

### Common Issues

#### 1. Logs not appearing in files

**Symptom:** Console logs work, but no log files created

**Solution:**
```bash
# Check NODE_ENV
echo $NODE_ENV  # Should be 'production' or 'staging'

# Check LOGS_DIR exists
mkdir -p ./logs
chmod 755 ./logs

# Check disk space
df -h
```

#### 2. Sentry not capturing errors

**Symptom:** Errors logged, but not in Sentry dashboard

**Checklist:**
- [ ] `SENTRY_DSN` is set correctly
- [ ] `SENTRY_ENVIRONMENT` matches environment
- [ ] Error occurs in production/staging (Sentry disabled in dev)
- [ ] Internet connectivity (Sentry is cloud-based)
- [ ] Check Sentry project filters (not ignoring error type)

**Debug:**
```typescript
// Add to bootstrap (main.ts)
if (sentryDsn) {
  console.log('[Sentry] DSN configured:', sentryDsn.substring(0, 30) + '...');
  console.log('[Sentry] Environment:', environment);
  console.log('[Sentry] Enabled:', environment !== 'development');
}
```

#### 3. Correlation IDs missing

**Symptom:** Logs don't include `correlationId`

**Solution:**
```typescript
// Ensure CorrelationIdMiddleware is registered
// In app.module.ts
configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(CorrelationIdMiddleware, ...)
    .forRoutes('*');
}

// In logs, always include correlationId
logger.log('Message', 'Context', {
  correlationId: req.correlationId
});
```

#### 4. Log files growing too large

**Symptom:** Disk space issues

**Solution:**
```bash
# Check log file sizes
du -sh logs/*

# Winston automatically rotates and compresses logs
# Adjust retention in logger.service.ts:
maxFiles: '7d'  # Keep for 7 days instead of 14

# Manual cleanup (if needed)
find logs -name "*.log" -mtime +7 -delete
find logs -name "*.gz" -mtime +14 -delete
```

#### 5. Sensitive data in logs

**Symptom:** Passwords/tokens visible in logs

**Solution:**
```typescript
// Add field to sensitiveFields array in RequestLoggingInterceptor
private readonly sensitiveFields = [
  'password',
  'token',
  'secret',
  'apiKey',
  'creditCard',
  'ssn',
  'yourSensitiveField'  // Add here
];

// For custom sanitization
const sanitized = { ...data };
delete sanitized.password;
logger.log('User registered', 'AuthService', sanitized);
```

---

## References

### Documentation
- **Winston:** https://github.com/winstonjs/winston
- **Sentry Node:** https://docs.sentry.io/platforms/node/
- **NestJS Logging:** https://docs.nestjs.com/techniques/logger
- **OWASP Logging:** https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

### Code Locations
- **AppLoggerService:** `src/common/services/logger.service.ts`
- **SentryService:** `src/common/services/sentry.service.ts`
- **CorrelationIdMiddleware:** `src/common/middleware/correlation-id.middleware.ts`
- **RequestLoggingInterceptor:** `src/common/interceptors/request-logging.interceptor.ts`
- **AllExceptionsFilter:** `src/common/filters/all-exceptions.filter.ts`

### Environment Configuration
- **.env.example:** `apps/food-waste-backend/.env.example`

---

## Summary

The Food Waste Backend logging infrastructure provides:

✅ **Comprehensive Logging** - Winston with structured JSON, daily rotation, and retention policies
✅ **Real-time Error Tracking** - Sentry integration with automatic error capture
✅ **Distributed Tracing** - Correlation IDs across all logs and systems
✅ **Performance Monitoring** - Request timing, memory usage, and slow query detection
✅ **Security & Compliance** - PII redaction, secure stack traces, and audit trails
✅ **Production-Ready** - Tested, documented, and optimized for scale

For support or questions, contact the development team.

---

**Last Updated:** 2025-01-15
**Version:** 1.0.0
**Author:** Food Waste Development Team
