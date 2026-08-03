/**
 * Which responsibilities this Node process carries.
 *
 * The API was previously a single process doing everything: HTTP, 29 `@Cron`
 * jobs and every Bull processor on one event loop. A heavy rollup (archive,
 * review analytics) blocked request handling for its whole runtime, because
 * Node has exactly one thread to give.
 *
 * Splitting by role lets scheduled work be scaled — and starved — independently
 * of user-facing traffic. The two failure modes stay separate: a queue backlog
 * no longer shows up as checkout latency.
 *
 * ## The roles
 *
 * | Role     | Serves HTTP/WS | Runs `@Cron` | Intended deployment          |
 * | -------- | -------------- | ------------ | ---------------------------- |
 * | `api`    | yes            | no           | N replicas behind the LB     |
 * | `worker` | yes (health)   | yes          | exactly one small replica    |
 * | `all`    | yes            | yes          | local dev, single-box deploys|
 *
 * `all` is the default so that development, tests and any existing deployment
 * that sets no env var behave exactly as before. Splitting is opt-in.
 *
 * ## Why `worker` still listens on a port
 *
 * Container platforms health-check over HTTP. A worker that binds nothing looks
 * dead and gets reaped. It serves the same app; it simply also owns the crons.
 *
 * ## This is not what makes crons safe
 *
 * Multi-replica safety comes from the Redis lock in `CronLockService`, not from
 * this setting. The role gate is an efficiency measure: it stops API replicas
 * from waking up, contending for a lock they should not win, and going back to
 * sleep. Were the gate misconfigured to `all` everywhere, the system would
 * still be correct — just wasteful. Never rely on the reverse.
 */
export const ProcessRole = {
  /** Serves traffic. Never runs scheduled work. */
  API: 'api',
  /** Runs scheduled work. Serves only health checks in practice. */
  WORKER: 'worker',
  /** Both. The default, and the right choice for a single-process deployment. */
  ALL: 'all',
} as const;

export type ProcessRoleValue = (typeof ProcessRole)[keyof typeof ProcessRole];

/** Every valid value, for Joi validation and error messages. */
export const PROCESS_ROLE_VALUES: readonly ProcessRoleValue[] = Object.values(ProcessRole);

/**
 * Reads the role straight from `process.env`.
 *
 * Deliberately not injected through `ConfigService`: this is consulted by
 * `CronLockService` on every tick, and reading a string from the environment is
 * both cheaper and available before the DI container finishes booting.
 *
 * An unrecognised value falls back to `ALL` rather than throwing. Joi already
 * rejects bad values at startup, so reaching this branch means the process is
 * already running — and silently disabling every scheduled job (payouts among
 * them) over a typo is far worse than doing redundant, lock-protected work.
 */
export function getProcessRole(): ProcessRoleValue {
  const raw = (process.env['PROCESS_ROLE'] ?? ProcessRole.ALL).trim().toLowerCase();

  return PROCESS_ROLE_VALUES.includes(raw as ProcessRoleValue)
    ? (raw as ProcessRoleValue)
    : ProcessRole.ALL;
}

/** True when this process should execute `@Cron` bodies. */
export function isSchedulerProcess(): boolean {
  const role = getProcessRole();
  return role === ProcessRole.WORKER || role === ProcessRole.ALL;
}
