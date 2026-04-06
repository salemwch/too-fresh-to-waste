/**
 * PM2 Ecosystem Configuration
 * Enables cluster mode for horizontal scaling across all CPU cores.
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production   # zero-downtime reload
 *   pm2 monit                                          # monitoring dashboard
 *   pm2 logs food-waste-api                            # view logs
 *
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */
module.exports = {
  apps: [
    {
      name: 'food-waste-api',
      script: 'dist/main.js',
      instances: 'max', // Use all available CPUs
      exec_mode: 'cluster', // Enable cluster mode for load balancing
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',

      // Graceful shutdown
      kill_timeout: 5000, // Wait 5s for graceful shutdown
      listen_timeout: 10000, // Wait 10s for app to listen
      shutdown_with_message: true, // Send SIGINT message before SIGTERM

      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Environment: Development
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      // Environment: Production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NODE_OPTIONS: '--max-old-space-size=2048',
      },

      // Environment: Staging
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        NODE_OPTIONS: '--max-old-space-size=1024',
      },
    },
  ],
};
