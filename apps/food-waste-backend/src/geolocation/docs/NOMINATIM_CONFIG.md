# OpenStreetMap Nominatim Configuration

This document describes the environment variables required to configure the
OpenStreetMap Nominatim geocoding service integration.

## Required Environment Variables

Add these variables to your `.env` file:

```bash
# ===========================================
# NOMINATIM GEOCODING SERVICE CONFIGURATION
# ===========================================

# Base URL for Nominatim API (default: https://nominatim.openstreetmap.org)
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org

# User Agent for API requests (REQUIRED - Nominatim requires identification)
# Format: AppName/Version (website; contact-email)
NOMINATIM_USER_AGENT=RescueEats-App/1.0 (https://rescueeats.com; contact@rescueeats.com)

# Request timeout in milliseconds (default: 10000)
NOMINATIM_TIMEOUT=10000

# Number of retry attempts on failure (default: 3)
NOMINATIM_RETRY_ATTEMPTS=3

# Delay between retries in milliseconds (default: 1000)
NOMINATIM_RETRY_DELAY=1000

# Rate limiting configuration
# Requests per second (default: 1 - Nominatim usage policy)
NOMINATIM_REQUESTS_PER_SECOND=1

# Burst size for rate limiting (default: 5)
NOMINATIM_BURST_SIZE=5

# Default language for results (default: en)
NOMINATIM_DEFAULT_LANGUAGE=en

# Default country codes (comma-separated, optional)
# Limits searches to specific countries if set
NOMINATIM_DEFAULT_COUNTRIES=FR,US,GB,DE,ES,IT

# Caching configuration
NOMINATIM_ENABLE_CACHE=true
NOMINATIM_CACHE_TTL=3600000
```

## Configuration Details

### Base URL Options

#### Official OpenStreetMap Nominatim (Public)

```bash
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
```

- **Pros**: Free, no API key required
- **Cons**: Rate limited to 1 request/second, usage policy restrictions
- **Best for**: Development, testing, low-volume applications

#### Self-hosted Nominatim Instance

```bash
NOMINATIM_BASE_URL=https://your-nominatim-server.com
```

- **Pros**: No rate limits, full control, better performance
- **Cons**: Requires server setup and maintenance, data updates
- **Best for**: Production environments with high volume

### User Agent Requirements

⚠️ **CRITICAL**: Nominatim requires a proper User-Agent header that identifies
your application and provides contact information.

**Valid format examples:**

```bash
NOMINATIM_USER_AGENT=RescueEats-App/1.0 (https://rescueeats.com; contact@rescueeats.com)
NOMINATIM_USER_AGENT=MyFoodApp/2.1 (https://myfoodapp.com; admin@myfoodapp.com)
NOMINATIM_USER_AGENT=WasteReductionApp/1.0 (https://github.com/username/repo; user@email.com)
```

**Invalid examples:**

- `curl/7.68.0`
- `MyApp`
- Generic browser user agents

### Rate Limiting

OpenStreetMap Nominatim usage policy:

- Maximum 1 request per second
- No more than 100 requests per minute
- Bulk geocoding requires special arrangements

```bash
# Conservative settings (recommended for public Nominatim)
NOMINATIM_REQUESTS_PER_SECOND=1
NOMINATIM_BURST_SIZE=5

# For self-hosted instances, you can increase these:
NOMINATIM_REQUESTS_PER_SECOND=10
NOMINATIM_BURST_SIZE=50
```

### Language Configuration

Supported languages (ISO 639-1 codes):

- `en` - English (default)
- `fr` - French
- `de` - German
- `es` - Spanish
- `it` - Italian
- `pt` - Portuguese
- `ru` - Russian
- `zh` - Chinese

### Country Code Restrictions

Use ISO 3166-1 alpha-2 country codes:

```bash
# Restrict to European countries
NOMINATIM_DEFAULT_COUNTRIES=FR,DE,IT,ES,GB,NL,BE

# Restrict to North America
NOMINATIM_DEFAULT_COUNTRIES=US,CA,MX

# No restriction (leave empty or remove variable)
# NOMINATIM_DEFAULT_COUNTRIES=
```

## Production Recommendations

### For High-Volume Applications

1. **Use a self-hosted Nominatim instance**:

   ```bash
   NOMINATIM_BASE_URL=https://your-nominatim-server.com
   NOMINATIM_REQUESTS_PER_SECOND=10
   NOMINATIM_BURST_SIZE=50
   ```

2. **Enable aggressive caching**:

   ```bash
   NOMINATIM_ENABLE_CACHE=true
   NOMINATIM_CACHE_TTL=7200000  # 2 hours
   ```

3. **Configure proper monitoring**:
   - Monitor request rates and response times
   - Set up alerts for service degradation
   - Log all geocoding failures for analysis

### For Development/Testing

```bash
# Basic development configuration
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=YourApp-Dev/1.0 (https://yoursite.com; dev@yoursite.com)
NOMINATIM_REQUESTS_PER_SECOND=0.5
NOMINATIM_ENABLE_CACHE=true
NOMINATIM_DEFAULT_COUNTRIES=FR,US
```

## Usage Policy Compliance

When using public Nominatim services:

1. **Provide valid contact information** in User-Agent
2. **Respect rate limits** (max 1 req/sec)
3. **Cache results appropriately** to reduce API calls
4. **Handle errors gracefully** with proper fallbacks
5. **Consider self-hosting** for high-volume applications

## Service Health Monitoring

The service includes built-in health checks and usage statistics:

```typescript
// Check service health
const isHealthy = await nominatimService.isHealthy();

// Get usage statistics
const stats = nominatimService.getUsageStats();
console.log({
  totalRequests: stats.totalRequests,
  successRate: stats.successfulRequests / stats.totalRequests,
  averageResponseTime: stats.averageResponseTime,
  healthStatus: stats.healthStatus,
});
```

## Error Handling

The service handles various error conditions:

- **Rate limiting**: Automatic queuing and retry
- **Network timeouts**: Configurable timeout and retries
- **Invalid requests**: Validation with helpful error messages
- **Service unavailable**: Graceful degradation and error responses

## Testing Configuration

For testing purposes, you can use a minimal configuration:

```bash
# Minimal test configuration
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=TestApp/1.0 (https://localhost; test@example.com)
NOMINATIM_REQUESTS_PER_SECOND=0.5
NOMINATIM_TIMEOUT=5000
NOMINATIM_ENABLE_CACHE=false
```

This configuration ensures compliance with Nominatim usage policies while
providing reliable geocoding services for your food waste reduction application.
