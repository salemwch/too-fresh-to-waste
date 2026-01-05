
import { createClient } from 'redis';
import { AppLoggerService } from '../common/services/logger.service';

export async function testRedisConnection(): Promise<boolean> {
    const logger = new AppLoggerService();
    logger.log('🔄 Testing Redis Cloud connection...', 'RedisTest');

    const client = createClient({
        username: 'default',
        password: 'akJQk5GovecSixkGeoUcTzn1cl3QiBJ2',
        socket: {
            host: 'redis-16469.c339.eu-west-3-1.ec2.redns.redis-cloud.com',
            port: 16469,
            tls: true,
            connectTimeout: 10000,
        }
    });

    try {
        await client.connect();

        // Test basic operations
        await client.set('test:review-cache', 'Redis is working!');
        const result = await client.get('test:review-cache');

        if (result === 'Redis is working!') {
            logger.log('✅ Redis connection successful!', 'RedisTest');
            await client.del('test:review-cache'); // Clean up
            return true;
        } else {
            logger.log('❌ Redis test failed - unexpected result', 'RedisTest');
            return false;
        }

    } catch (error) {
        logger.error('❌ Redis connection failed', error instanceof Error ? error.stack : String(error), 'RedisTest');
        return false;
    } finally {
        await client.quit();
    }
}

// Uncomment to run directly:
// testRedisConnection();