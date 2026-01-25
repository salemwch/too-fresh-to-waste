# Health Check System

## Overview

Production-ready health monitoring system built with `@nestjs/terminus` for Kubernetes deployments, load balancers, and monitoring systems. Provides comprehensive checks for database, Redis, and memory resources with custom indicators.

**Endpoints:**
- `GET /health` - Full health check (all dependencies)
- `GET /health/liveness` - K8s liveness probe (simple)
- `GET /health/readiness` - K8s readiness probe (critical dependencies)

**Status codes:**
- `200 OK` - All checks passed
- `503 Service Unavailable` - One or more checks failed

---

## Architecture

### Components

```
health/
├── health.controller.ts       # HTTP endpoints
├── health.module.ts           # Module configuration
└── indicators/
    └── redis.health.ts        # Custom Redis health indicator
```

### Dependencies

- **@nestjs/terminus** - Health check framework
- **MongooseHealthIndicator** - Database connectivity checks
- **MemoryHealthIndicator** - Heap/RSS memory monitoring
- **RedisHealthIndicator** - Custom Redis health indicator

### Request Flow

```
Client → Controller → HealthCheckService → Indicators → Response
                                          ├─ Database
                                          ├─ Redis
                                          └─ Memory
```

---

## Endpoints

### 1. Comprehensive Health Check

**Route:** `GET /health`

**Purpose:** Full system health validation for monitoring dashboards and alerting.

**Checks:**
- Database connectivity (MongoDB) - 3s timeout
- Redis connectivity and latency
- Heap memory usage (< 150MB threshold)
- RSS memory usage (< 150MB threshold)

**Response (200 OK):**
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up",
      "message": "Redis is healthy",
      "latency": 2
    },
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up",
      "message": "Redis is healthy",
      "latency": 2
    },
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    }
  }
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "error",
  "info": {
    "database": {
      "status": "up"
    }
  },
  "error": {
    "redis": {
      "status": "down",
      "message": "Connection timeout"
    }
  },
  "details": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "down",
      "message": "Connection timeout"
    }
  }
}
```

**Use cases:**
- External monitoring (Datadog, New Relic, Prometheus)
- Load balancer health checks (ALB, NGINX)
- CI/CD deployment verification

---

### 2. Liveness Probe

**Route:** `GET /health/liveness`

**Purpose:** Verify application process is running. Does NOT check external dependencies.

**Checks:**
- HTTP server responds
- Node.js process is alive

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T12:34:56.789Z",
  "uptime": 3600.5,
  "environment": "production"
}
```

**Kubernetes configuration:**
```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**Behavior:**
- **Passes:** Application always responds (unless crashed)
- **Fails:** Process unresponsive or crashed
- **K8s action:** Restart pod on failure

---

### 3. Readiness Probe

**Route:** `GET /health/readiness`

**Purpose:** Verify application can accept traffic. Checks critical dependencies.

**Checks:**
- Database connectivity (MongoDB) - 3s timeout
- Redis connectivity

**Response (200 OK):**
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up",
      "message": "Redis is healthy",
      "latency": 1
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up",
      "message": "Redis is healthy",
      "latency": 1
    }
  }
}
```

**Kubernetes configuration:**
```yaml
readinessProbe:
  httpGet:
    path: /health/readiness
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
  successThreshold: 1
```

**Behavior:**
- **Passes:** Database and Redis both reachable
- **Fails:** Database OR Redis unavailable
- **K8s action:** Remove pod from service endpoints (no traffic)

---

## Custom Indicators

### RedisHealthIndicator

**Location:** `src/health/indicators/redis.health.ts`

**Purpose:** Custom health indicator for Redis connectivity with latency measurement.

**Features:**
- Dedicated Redis client for health checks (isolated from app pool)
- Connection timeout: 3s
- No retry strategy (fail fast)
- Latency measurement via double-ping
- TLS support via `REDIS_TLS` env variable

**Implementation:**
```typescript
async isHealthy(key: string): Promise<HealthIndicatorResult> {
  try {
    const result = await this.redis.ping();

    if (result === 'PONG') {
      return this.getStatus(key, true, {
        message: 'Redis is healthy',
        latency: await this.getLatency(),
      });
    }

    throw new Error('Invalid ping response');
  } catch (error) {
    throw new HealthCheckError(
      'Redis health check failed',
      this.getStatus(key, false, {
        message: error.message,
      }),
    );
  }
}
```

**Configuration:**
Uses standard Redis environment variables:
- `REDIS_HOST` (default: localhost)
- `REDIS_PORT` (default: 6379)
- `REDIS_PASSWORD`
- `REDIS_USERNAME` (default: default)
- `REDIS_TLS` (set to 'true' for TLS)

**Cleanup:**
Implements `onModuleDestroy()` to gracefully close Redis connection on shutdown.

---

## Configuration

### Memory Thresholds

**Location:** `health.controller.ts:71-74`

```typescript
// Heap memory check (< 150MB)
() => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),

// RSS memory check (< 150MB)
() => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
```

**Tuning guidance:**
- **Development:** 150MB is sufficient
- **Production:** Increase to 512MB-1GB based on load
- **High traffic:** Monitor actual usage and set threshold at 80% of container limit

### Database Timeout

**Location:** `health.controller.ts:65, 134`

```typescript
() => this.db.pingCheck('database', { timeout: 3000 })
```

**Default:** 3 seconds (3000ms)

**Tuning guidance:**
- Network latency < 100ms → 1s timeout
- Cloud deployments → 3s timeout (default)
- Cross-region → 5s timeout

---

## Kubernetes Integration

### Complete Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: foodwaste-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: foodwaste-backend
  template:
    metadata:
      labels:
        app: foodwaste-backend
    spec:
      containers:
      - name: backend
        image: foodwaste/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: database-url
        - name: REDIS_HOST
          value: "redis-service"
        - name: REDIS_PORT
          value: "6379"

        # Liveness Probe - Restart if unresponsive
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        # Readiness Probe - Remove from service if dependencies down
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
          successThreshold: 1

        # Startup Probe - Allow longer startup time
        startupProbe:
          httpGet:
            path: /health/liveness
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30  # 5 minutes total

        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Probe Strategy

| Phase | Probe | Purpose | Action on Failure |
|-------|-------|---------|-------------------|
| **Startup** | Liveness | Wait for app initialization | Restart pod |
| **Running** | Readiness | Check dependencies before traffic | Remove from endpoints |
| **Running** | Liveness | Detect process hang/crash | Restart pod |

---

## Usage Examples

### Local Development

```bash
# Full health check
curl http://localhost:3000/health

# Liveness probe
curl http://localhost:3000/health/liveness

# Readiness probe
curl http://localhost:3000/health/readiness
```

### Docker Health Check

**Dockerfile:**
```dockerfile
FROM node:24.11.1-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health/liveness', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: mongodb://mongo:27017/foodwaste
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      mongo:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/liveness"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s

  mongo:
    image: mongo:6
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
```

### Load Balancer Configuration (NGINX)

```nginx
upstream backend {
    server backend1.example.com:3000 max_fails=3 fail_timeout=30s;
    server backend2.example.com:3000 max_fails=3 fail_timeout=30s;
    server backend3.example.com:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Health check
        health_check interval=10s fails=3 passes=2 uri=/health/readiness;
    }
}
```

### Prometheus Monitoring

**Alert rules:**
```yaml
groups:
  - name: backend_health
    interval: 30s
    rules:
      - alert: BackendUnhealthy
        expr: up{job="foodwaste-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Backend service is down"
          description: "Backend has been unreachable for 1 minute"

      - alert: BackendDatabaseUnhealthy
        expr: |
          probe_success{job="foodwaste-backend",endpoint="/health"} == 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Backend health check failing"
          description: "Database or Redis connectivity issues"
```

---

## Troubleshooting

### Common Issues

#### 1. Health Check Always Returns 503

**Symptoms:**
```json
{
  "status": "error",
  "error": {
    "database": {
      "status": "down",
      "message": "Timeout"
    }
  }
}
```

**Causes:**
- Database not reachable
- Firewall blocking MongoDB port (27017)
- Invalid `DATABASE_URL` connection string

**Solutions:**
```bash
# Test MongoDB connection manually
mongosh "$DATABASE_URL" --eval "db.adminCommand('ping')"

# Check network connectivity
nc -zv mongodb-host 27017

# Verify credentials
echo $DATABASE_URL | grep -o 'mongodb://[^@]*@'
```

#### 2. Redis Health Check Fails

**Symptoms:**
```json
{
  "error": {
    "redis": {
      "status": "down",
      "message": "Connection refused"
    }
  }
}
```

**Causes:**
- Redis not running
- Incorrect `REDIS_HOST` or `REDIS_PORT`
- Authentication required but `REDIS_PASSWORD` not set

**Solutions:**
```bash
# Test Redis connection
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping

# Check Redis logs
docker logs redis-container

# Verify environment variables
env | grep REDIS
```

#### 3. Memory Health Check Fails

**Symptoms:**
```json
{
  "error": {
    "memory_heap": {
      "status": "down"
    }
  }
}
```

**Causes:**
- Application exceeding 150MB heap threshold
- Memory leak
- High concurrent load

**Solutions:**
```bash
# Monitor memory usage
curl http://localhost:3000/health | jq '.details.memory_heap'

# Increase threshold in health.controller.ts (line 71)
() => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),  # 512MB

# Investigate memory leak
node --inspect dist/main.js
# Use Chrome DevTools → Memory → Take heap snapshot
```

#### 4. Kubernetes Pod Restart Loop

**Symptoms:**
```bash
kubectl get pods
# NAME                        READY   STATUS             RESTARTS   AGE
# backend-7d8f9c4b5-abc12     0/1     CrashLoopBackOff   5          3m
```

**Diagnosis:**
```bash
# Check pod logs
kubectl logs backend-7d8f9c4b5-abc12

# Check events
kubectl describe pod backend-7d8f9c4b5-abc12

# Test health endpoints manually
kubectl port-forward backend-7d8f9c4b5-abc12 3000:3000
curl http://localhost:3000/health/liveness
```

**Common causes:**
- `initialDelaySeconds` too short (app not ready)
- Database not reachable from cluster
- Missing secrets (DATABASE_URL, REDIS_PASSWORD)

**Solutions:**
```yaml
# Increase startup time
startupProbe:
  initialDelaySeconds: 60  # Give more time
  failureThreshold: 30

# Verify secrets exist
kubectl get secrets
kubectl describe secret backend-secrets
```

#### 5. Load Balancer Marks Instance Unhealthy

**Symptoms:**
- Load balancer removes instance from pool
- Traffic stops reaching instance

**Diagnosis:**
```bash
# Test health endpoint from LB perspective
curl -v http://instance-ip:3000/health/readiness

# Check LB logs (AWS ALB example)
aws elbv2 describe-target-health --target-group-arn arn:...
```

**Solutions:**
- Verify security group allows LB → instance on port 3000
- Check readiness probe timeout vs actual response time
- Ensure Redis/MongoDB accessible from instance

---

## Extending Health Checks

### Adding Custom Indicator

**Example: External API Health Check**

**1. Create indicator:**
```typescript
// src/health/indicators/external-api.health.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class ExternalApiHealthIndicator extends HealthIndicator {
  constructor(private http: HttpService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const response = await lastValueFrom(
        this.http.get('https://api.example.com/status', {
          timeout: 3000,
        })
      );

      if (response.status === 200) {
        return this.getStatus(key, true, {
          message: 'External API is reachable',
        });
      }

      throw new Error(`Unexpected status: ${response.status}`);
    } catch (error) {
      throw new HealthCheckError(
        'External API health check failed',
        this.getStatus(key, false, {
          message: error.message,
        }),
      );
    }
  }
}
```

**2. Register in module:**
```typescript
// health.module.ts
import { ExternalApiHealthIndicator } from './indicators/external-api.health';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    ExternalApiHealthIndicator,  // Add here
  ],
})
export class HealthModule {}
```

**3. Add to controller:**
```typescript
// health.controller.ts
constructor(
  private readonly health: HealthCheckService,
  private readonly externalApi: ExternalApiHealthIndicator,
) {}

@Get()
@HealthCheck()
check() {
  return this.health.check([
    () => this.db.pingCheck('database', { timeout: 3000 }),
    () => this.redis.isHealthy('redis'),
    () => this.externalApi.isHealthy('external-api'),  // Add here
  ]);
}
```

---

## Best Practices

### 1. Endpoint Selection

- **Monitoring dashboards** → Use `/health` (comprehensive)
- **K8s liveness** → Use `/health/liveness` (no dependencies)
- **K8s readiness** → Use `/health/readiness` (critical only)
- **Load balancers** → Use `/health/readiness`

### 2. Timeout Configuration

- **Health check timeout** < **Probe timeout** < **Failure threshold × Period**
- Example: Health (3s) < Probe (5s) < Total (30s)

### 3. Threshold Tuning

- Set memory thresholds at **80% of container limit**
- Use **P99 latency** for timeout values
- **Test under load** before production

### 4. Probe Intervals

- **Liveness:** 10-30s (too frequent = unnecessary load)
- **Readiness:** 5-10s (faster reaction to issues)
- **Startup:** 10s with high failure threshold (30x = 5min)

### 5. Security

- Health endpoints are **@Public()** (no authentication)
- **Do NOT expose sensitive data** in health responses
- Consider **IP whitelisting** for `/health` in production

### 6. Logging

- Log health check failures with correlation IDs
- Track health check latency in metrics
- Alert on repeated failures (not single flaps)

---

## Performance Considerations

### Impact on Production

**Load from health checks:**
```
Requests per second = (Pods × Replicas) / Interval

Example:
- 3 replicas
- 5s readiness interval
- 10s liveness interval

RPS = (3 × 2 probes) / 10s = 0.6 RPS
Database connections = 3 concurrent pings
```

**Optimization:**
- Use connection pooling (health checks reuse pool)
- Set appropriate timeouts (3s max)
- Disable retries in health check clients

### Caching Strategy

**NOT recommended** for health checks because:
- Defeats purpose of real-time validation
- Can mask actual failures
- K8s expects fresh data

---

## References

### Internal Files

- `src/health/health.controller.ts:47-76` - Comprehensive health check
- `src/health/health.controller.ts:88-105` - Liveness probe
- `src/health/health.controller.ts:117-137` - Readiness probe
- `src/health/indicators/redis.health.ts:39-60` - Redis indicator

### External Documentation

- **@nestjs/terminus**: https://docs.nestjs.com/recipes/terminus
- **Kubernetes probes**: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- **Docker HEALTHCHECK**: https://docs.docker.com/engine/reference/builder/#healthcheck

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-15 | Initial documentation - Redis indicator, K8s probes, comprehensive checks |
