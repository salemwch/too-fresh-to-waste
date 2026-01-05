# Redis SSL/TLS Configuration Guide

## Overview

This guide covers different Redis SSL/TLS configurations for various deployment
scenarios.

## 1. Redis Cloud (RedisLabs, AWS ElastiCache)

### Environment Variables

```env
# Basic Redis Configuration
REDIS_HOST=your-redis-host.redis-cloud.com
REDIS_PORT=16469  # Regular port
REDIS_TLS_PORT=16470  # SSL port (usually +1)
REDIS_PASSWORD=your-password
REDIS_USERNAME=default

# SSL Configuration
REDIS_TLS=true
REDIS_TLS_REJECT_UNAUTHORIZED=false
REDIS_TLS_CHECK_SERVER_IDENTITY=false
REDIS_TLS_MIN_VERSION=TLSv1.2

# Connection Settings
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=3
```

### Node.js Redis Client Configuration

```typescript
import { createClient } from 'redis';

const client = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_TLS_PORT || process.env.REDIS_PORT),
    tls:
      process.env.REDIS_TLS === 'true'
        ? {
            rejectUnauthorized:
              process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
            checkServerIdentity:
              process.env.REDIS_TLS_CHECK_SERVER_IDENTITY !== 'false'
                ? undefined
                : () => undefined,
            minVersion: process.env.REDIS_TLS_MIN_VERSION || 'TLSv1.2',
            // Additional TLS options
            ciphers:
              'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS',
            honorCipherOrder: true,
          }
        : undefined,
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
    reconnectStrategy: retries => {
      const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '3');
      if (retries > maxRetries) return false;
      return Math.min(retries * 50, 500);
    },
  },
});
```

## 2. Self-Hosted Redis with SSL Certificates

### Generate SSL Certificates

```bash
# Create certificate directory
mkdir -p /etc/redis/ssl

# Generate private key
openssl genrsa -out /etc/redis/ssl/redis-server-key.pem 2048

# Generate certificate signing request
openssl req -new -key /etc/redis/ssl/redis-server-key.pem -out /etc/redis/ssl/redis-server.csr

# Generate self-signed certificate
openssl x509 -req -days 365 -in /etc/redis/ssl/redis-server.csr \
  -signkey /etc/redis/ssl/redis-server-key.pem \
  -out /etc/redis/ssl/redis-server-cert.pem

# Set proper permissions
chmod 600 /etc/redis/ssl/redis-server-key.pem
chmod 644 /etc/redis/ssl/redis-server-cert.pem
```

### Redis Server Configuration (redis.conf)

```conf
# Basic configuration
port 0  # Disable non-SSL port
tls-port 6380  # Enable SSL port

# SSL Certificate configuration
tls-cert-file /etc/redis/ssl/redis-server-cert.pem
tls-key-file /etc/redis/ssl/redis-server-key.pem

# Optional: Certificate Authority
# tls-ca-cert-file /etc/redis/ssl/ca-cert.pem

# SSL Configuration
tls-protocols "TLSv1.2 TLSv1.3"
tls-ciphersuites TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256
tls-ciphers ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS

# Security settings
tls-prefer-server-ciphers yes
tls-session-caching no
tls-session-cache-size 5000
tls-session-cache-timeout 60

# Authentication
requirepass your-secure-password
```

### Environment Variables for Self-Hosted

```env
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=your-secure-password
REDIS_TLS=true
REDIS_TLS_CERT_FILE=/etc/redis/ssl/redis-server-cert.pem
REDIS_TLS_KEY_FILE=/etc/redis/ssl/redis-server-key.pem
REDIS_TLS_CA_FILE=/etc/redis/ssl/ca-cert.pem
REDIS_TLS_REJECT_UNAUTHORIZED=true
```

## 3. Redis with stunnel Proxy

### stunnel Configuration (/etc/stunnel/redis.conf)

```conf
[redis]
accept = 6380
connect = 127.0.0.1:6379
cert = /etc/ssl/certs/redis.crt
key = /etc/ssl/private/redis.key
CAfile = /etc/ssl/certs/ca-certificates.crt
```

### Environment Variables for stunnel

```env
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_TLS=true
REDIS_PASSWORD=your-password
```

## 4. Development vs Production Configurations

### Development (.env.development)

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TLS=false
REDIS_PASSWORD=dev-password
```

### Production (.env.production)

```env
REDIS_HOST=prod-redis.example.com
REDIS_PORT=6380
REDIS_TLS=true
REDIS_TLS_REJECT_UNAUTHORIZED=true
REDIS_TLS_CHECK_SERVER_IDENTITY=true
REDIS_PASSWORD=secure-production-password
REDIS_TLS_CERT_FILE=/app/ssl/redis-cert.pem
REDIS_TLS_KEY_FILE=/app/ssl/redis-key.pem
REDIS_TLS_CA_FILE=/app/ssl/ca-cert.pem
```

## 5. AWS ElastiCache with SSL

### Environment Variables

```env
REDIS_HOST=your-cluster.cache.amazonaws.com
REDIS_PORT=6380
REDIS_TLS=true
REDIS_PASSWORD=your-auth-token
# ElastiCache uses AWS certificates
REDIS_TLS_REJECT_UNAUTHORIZED=true
REDIS_TLS_CHECK_SERVER_IDENTITY=true
```

## 6. Docker Configuration

### docker-compose.yml with SSL

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6380:6380'
    volumes:
      - ./redis.conf:/usr/local/etc/redis/redis.conf
      - ./ssl:/etc/redis/ssl
    command: redis-server /usr/local/etc/redis/redis.conf
    environment:
      - REDIS_TLS=true

  app:
    build: .
    depends_on:
      - redis
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6380
      - REDIS_TLS=true
      - REDIS_TLS_REJECT_UNAUTHORIZED=false
```

## Troubleshooting

### Common Issues

1. **SSL Packet Length Error**: Usually means TLS is enabled but server doesn't
   support it
2. **Certificate Verification Failed**: Check certificate paths and permissions
3. **Connection Timeout**: Verify firewall and port configurations
4. **Handshake Failure**: Check TLS versions and cipher suites

### Debug Commands

```bash
# Test Redis connection without SSL
redis-cli -h hostname -p 6379 ping

# Test Redis connection with SSL
redis-cli -h hostname -p 6380 --tls ping

# Check certificate details
openssl x509 -in certificate.pem -text -noout

# Test SSL connection
openssl s_client -connect hostname:6380
```
