/**
 * PM2 Ecosystem Configuration
 *
 * Defines the API process. In containers this is started with `pm2-runtime`
 * (see Dockerfile), which stays in the foreground and forwards signals — plain
 * `pm2 start` daemonises and exits, which a container reads as a crash.
 *
 * Usage:
 *   pm2-runtime start ecosystem.config.js --env production  # containers
 *   pm2 start ecosystem.config.js --env production          # bare metal / VM
 *   pm2 reload ecosystem.config.js --env production         # zero-downtime reload
 *   pm2 monit                                               # monitoring dashboard
 *   pm2 logs food-waste-api                                 # view logs
 *
 * ## Why cluster mode matters here
 *
 * Node runs one thread. Before this config was actually used, the container
 * started `node dist/main.js` directly, so every HTTP request, all 29 `@Cron`
 * jobs and every Bull processor shared a single event loop on a single core —
 * a heavy analytics rollup blocked checkout for its whole runtime, and the
 * other cores sat idle. Cluster mode forks one worker per core behind PM2's
 * built-in load balancer.
 *
 * ## PROCESS_ROLE
 *
 * `PROCESS_ROLE=api` stops these workers from executing scheduled jobs; see
 * `src/config/process-role.ts`. Run the scheduled half as a **separate PM2
 * app or container** with `PROCESS_ROLE=worker` and `instances: 1`, so a slow
 * job can never compete with request handling.
 *
 * Correctness does not depend on getting this right — `CronLockService` holds a
 * Redis lock that already makes multi-replica crons safe. The role split is
 * about isolation, not correctness.
 *
 * ## Connection-pool arithmetic (the trap)
 *
 * `MONGO_MAX_POOL_SIZE` is **per process**, not per service. Cluster mode
 * multiplies it by the core count, and replicas multiply it again:
 *
 *     total sockets = MONGO_MAX_POOL_SIZE × instances × replicas
 *
 * Left at the default 100 on an 8-core box, one container opens 800 connections
 * and two containers exceed a mid-tier Atlas cluster's limit, at which point
 * Atlas refuses new connections and the API is down. Size it deliberately:
 *
 *     MONGO_MAX_POOL_SIZE ≈ (cluster connection limit × 0.8) / (instances × replicas)
 *
 * `instances: 'max'` makes the core count implicit and therefore invisible in
 * that formula — and it reads the *host's* core count, not this container's
 * share, so on a 0.1-CPU instance it would fork one worker per host core. The
 * count is therefore detected from the cgroup limit instead (see
 * `container-resources.ts`), with `WEB_CONCURRENCY` as an explicit override.
 *
 * Below two whole CPUs the detector returns 1: cluster mode there costs memory
 * and gains nothing, since the workers only contend for the same fraction of a
 * core.
 */

/*
 * Sizing is detected from the container's own cgroup limits, so the same image
 * is correctly configured on a free 0.1-CPU instance and on an 8-core paid one
 * with nothing to change here. Upgrading a plan is a dashboard action, not a
 * code change — which is the whole point.
 *
 * Loaded from `dist/` because the logic is TypeScript and unit-tested
 * (`container-resources.spec.ts`); PM2 only ever runs this file against a built
 * image. The fallback keeps `pnpm start:pm2` working before a first build
 * rather than failing with a confusing module-not-found.
 */
let resources;
try {
  resources = require('./dist/config/container-resources');
} catch {
  resources = {
    resolveClusterInstances: explicit => Number.parseInt(explicit ?? '', 10) || 1,
    resolveMaxMemoryRestart: () => '512M',
    resolveOldSpaceMb: () => 512,
  };
}

/** WEB_CONCURRENCY wins when set; otherwise derived from the CPU limit. */
const instances = resources.resolveClusterInstances(process.env.WEB_CONCURRENCY);

/**
 * Recycle thresholds as a share of the container's memory limit.
 *
 * A hardcoded `1G` was wrong in both directions: on a 512 MB instance the
 * kernel OOM-kills the process long before PM2 intervenes — dropping every
 * in-flight request with no graceful shutdown — and on a large instance it
 * restarts a healthy process that had headroom to spare.
 *
 * The share must sit ABOVE the app's steady-state footprint, or PM2 recycles a
 * process that is merely finished booting. At 0.7 on Render's 512 MB free
 * instance the threshold landed at 358 MB against a ~367 MB baseline, so every
 * worker was killed the moment it came up:
 *
 *   [PM2][WORKER] Process 0 restarted because it exceeds --max-memory-restart
 *   (current_memory=385396736 max_memory_limit=375390208)
 *
 * The app served health checks in the gaps, so this surfaced as intermittent
 * 502s and "no open ports detected" rather than as a memory problem.
 *
 * 0.9 keeps PM2 ahead of the kernel — it still recycles before the cgroup
 * limit, so shutdown stays graceful — while leaving room for a baseline that
 * legitimately occupies most of a small container. This is a leak catcher of
 * last resort, not a tuning knob; it should never be the thing bounding normal
 * operation.
 *
 * Baseline is ~370 MB (geoip-lite's in-memory database, sharp, the Mongo and
 * Redis pools, warmed leaderboard caches). Anything at or below 512 MB is
 * therefore marginal — see the note in render.yaml.
 */
const apiMaxMemory = resources.resolveMaxMemoryRestart(0.9, '512M');
const workerMaxMemory = resources.resolveMaxMemoryRestart(0.9, '512M');

/*
 * V8 heap ceiling per process. Derived for the same reason: promising V8 more
 * heap than the container has does not make the app faster, it makes the kernel
 * OOM-kill it without a graceful shutdown.
 */
const apiOldSpace = resources.resolveOldSpaceMb(instances, 0.6, 512);
const workerOldSpace = resources.resolveOldSpaceMb(1, 0.7, 512);

/*
 * Inherited from the container, defaulting to `all`.
 *
 * Hardcoding `api` here would be a silent, dangerous default: a single-container
 * deployment — which is what this repo has today — would start the API, run no
 * scheduled jobs at all, and look perfectly healthy. Payouts, order expiry and
 * trial expiry would simply stop, with nothing in the logs saying so.
 *
 * So splitting is opt-in: set PROCESS_ROLE=api on the API container only once a
 * PROCESS_ROLE=worker container is actually running beside it.
 */
const apiRole = process.env.PROCESS_ROLE ?? 'all';

/*
 * Inherited, never hardcoded.
 *
 * Managed platforms assign the port and expect the process to bind exactly it —
 * Render injects `PORT`, then probes that port to decide whether the service
 * came up. Writing a literal here would override the injected value, the probe
 * would find nothing listening, and the deploy would fail with "no open ports
 * detected" while the app sits there healthy on a port nobody is watching.
 *
 * The fallback only applies to local and bare-metal runs, where nothing assigns
 * one.
 */
const apiPort = process.env.PORT ?? 3000;

/*
 * The worker serves no traffic; this exists so that running both apps on one
 * host cannot collide on a port. `WORKER_PORT` rather than `PORT` because on a
 * platform that injects `PORT` per service, reusing it here would point the
 * worker at the API's assigned port.
 */
const workerPort = process.env.WORKER_PORT ?? 3001;

module.exports = {
  apps: [
    {
      name: 'food-waste-api',
      script: 'dist/main.js',
      instances,
      exec_mode: 'cluster', // Enable cluster mode for load balancing
      autorestart: true,
      watch: false,
      max_memory_restart: apiMaxMemory,

      // Graceful shutdown
      kill_timeout: 5000, // Wait 5s for graceful shutdown
      listen_timeout: 10000, // Wait 10s for app to listen
      shutdown_with_message: true, // Send SIGINT message before SIGTERM

      // Logging. In a container these go to stdout/stderr via pm2-runtime, so
      // no file paths: writing logs inside the image fills the layer and is
      // lost on restart.
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Environment: Development
      env: {
        NODE_ENV: 'development',
        PORT: apiPort,
        PROCESS_ROLE: apiRole,
      },

      // Environment: Production
      env_production: {
        NODE_ENV: 'production',
        PORT: apiPort,
        NODE_OPTIONS: `--max-old-space-size=${apiOldSpace}`,
        // Inherits the container's PROCESS_ROLE; 'all' unless explicitly split.
        PROCESS_ROLE: apiRole,
      },

      // Environment: Staging
      env_staging: {
        NODE_ENV: 'staging',
        PORT: apiPort,
        NODE_OPTIONS: `--max-old-space-size=${apiOldSpace}`,
        PROCESS_ROLE: apiRole,
      },
    },

    /*
     * The scheduled half. Started only when explicitly named:
     *
     *   pm2-runtime start ecosystem.config.js --only food-waste-worker --env production
     *
     * `instances: 1` on purpose. The Redis lock means extra replicas would be
     * safe, but they would only contend for locks they cannot win — the useful
     * parallelism is inside the Bull processors, which is what
     * `queue-concurrency.constant.ts` tunes.
     */
    {
      name: 'food-waste-worker',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      // A larger share than the API's: analytics rollups hydrate big result sets,
      // and a restart here drops in-flight jobs rather than user requests.
      max_memory_restart: workerMaxMemory,

      kill_timeout: 30000, // Jobs need longer than a request to wind down
      listen_timeout: 10000,
      shutdown_with_message: true,

      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      env: {
        NODE_ENV: 'development',
        PORT: workerPort,
        PROCESS_ROLE: 'worker',
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: workerPort,
        NODE_OPTIONS: `--max-old-space-size=${workerOldSpace}`,
        PROCESS_ROLE: 'worker',
      },

      env_staging: {
        NODE_ENV: 'staging',
        PORT: workerPort,
        NODE_OPTIONS: `--max-old-space-size=${workerOldSpace}`,
        PROCESS_ROLE: 'worker',
      },
    },
  ],
};
