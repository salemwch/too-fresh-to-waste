import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';

import { getProcessRole, isSchedulerProcess } from '../../config/process-role';
import { RedisService } from '../../redis/redis.service';

/**
 * Single-owner execution for scheduled work.
 *
 * `@nestjs/schedule` registers timers **in-process**. Every replica therefore
 * fires every cron. On one instance that is invisible; the moment a second
 * instance exists, every job runs N times concurrently.
 *
 * For most jobs that is wasted work. For `payout.task.ts` it is duplicate
 * merchant payouts — real money leaving the platform twice, with no automatic
 * recovery path. This service is what makes horizontal scaling safe.
 *
 * ## How the lock works
 *
 * `SET key token NX PX ttl` is atomic: exactly one replica wins. The value is a
 * per-attempt UUID so release can verify ownership — a plain `DEL` would let a
 * slow replica delete a lock that had already expired and been re-acquired by
 * someone else, silently allowing two concurrent runs. Release is a Lua CAS so
 * the compare and the delete cannot interleave.
 *
 * ## Fail-closed
 *
 * If Redis is unreachable the job is **skipped**, not run. Running unlocked is
 * precisely the failure this exists to prevent, and for payouts a late run is
 * enormously cheaper than a double run. Callers that genuinely do not care can
 * pass `runWithoutLockIfRedisDown: true`.
 *
 * ## TTL
 *
 * The TTL must exceed the job's worst-case runtime, or a second replica may
 * start while the first is still working. It must also be short enough that a
 * crashed holder does not block the next tick for long. There is no lock
 * extension here: pick a generous TTL and keep jobs idempotent.
 */
@Injectable()
export class CronLockService {
  private readonly logger = new Logger(CronLockService.name);

  /** Namespace so lock keys can never collide with cache or session keys. */
  private static readonly KEY_PREFIX = 'cronlock:';

  /**
   * Releases the lock only if we still hold it.
   *
   * KEYS[1] = lock key, ARGV[1] = the token we wrote. Runs atomically inside
   * Redis, so no other client can acquire between the GET and the DEL.
   */
  private static readonly RELEASE_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Runs `task` on at most one replica per tick.
   *
   * @param jobName  stable identifier — must be the same across replicas, and
   *                 unique per job. Changing it silently disables the lock.
   * @param ttlMs    lock lifetime; must exceed the job's worst-case runtime.
   * @param task     the work to perform.
   * @returns the task's result, or `undefined` when this replica did not win
   *          the lock (or Redis was unavailable under the default fail-closed
   *          policy). `undefined` is a normal outcome, not an error.
   */
  async runExclusive<T>(
    jobName: string,
    ttlMs: number,
    task: () => Promise<T>,
    options: { runWithoutLockIfRedisDown?: boolean } = {},
  ): Promise<T | undefined> {
    /*
     * Role gate, before any Redis round-trip.
     *
     * Every replica's timers fire regardless of role, so without this each API
     * replica would issue a `SET NX` per job per tick purely to discover it is
     * not the scheduler. That is pointless load on Redis and pointless wake-ups
     * on the event loop we are trying to keep free for requests.
     *
     * Correctness does not depend on this — the lock below is what prevents
     * concurrent runs. See `process-role.ts`.
     */
    if (!isSchedulerProcess()) {
      this.logger.debug(
        `Skipping "${jobName}" — PROCESS_ROLE=${getProcessRole()} does not run scheduled work`,
      );
      return undefined;
    }

    const key = `${CronLockService.KEY_PREFIX}${jobName}`;
    const token = randomUUID();

    let acquired: boolean;
    try {
      const client = await this.redisService.getClient();
      // NX = only if absent, PX = expire in ms. Returns null when another
      // replica already holds it.
      const reply = await client.set(key, token, { NX: true, PX: ttlMs });
      acquired = reply !== null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (options.runWithoutLockIfRedisDown === true) {
        this.logger.warn(
          `Redis unavailable acquiring lock for "${jobName}" (${message}) — ` +
            `running unlocked as configured. Concurrent execution is possible.`,
        );
        const unlockedResult = await task();
        return unlockedResult;
      }

      // Fail closed. A skipped tick is recoverable; a duplicate payout is not.
      this.logger.error(
        `Redis unavailable acquiring lock for "${jobName}" (${message}) — ` +
          `SKIPPING this run to avoid concurrent execution across replicas.`,
      );
      return undefined;
    }

    if (!acquired) {
      // The common, healthy case on every replica that did not win.
      this.logger.debug(`Lock "${jobName}" held elsewhere — skipping this tick`);
      return undefined;
    }

    try {
      return await task();
    } finally {
      await this.release(key, token, jobName);
    }
  }

  /**
   * Best-effort ownership-checked release.
   *
   * Never throws: the job has already finished, and the lock expires on its own
   * via the TTL, so a failed release must not turn a successful run into an error.
   */
  private async release(key: string, token: string, jobName: string): Promise<void> {
    try {
      const client = await this.redisService.getClient();
      const released = await client.eval(CronLockService.RELEASE_SCRIPT, {
        keys: [key],
        arguments: [token],
      });

      if (released === 0) {
        // We ran longer than the TTL: the lock expired and possibly someone
        // else holds it now. Worth surfacing — it means the TTL is too short
        // for this job, which is exactly how concurrent runs sneak back in.
        this.logger.warn(
          `Lock "${jobName}" had already expired before release — ` +
            `the job outran its TTL. Increase the TTL for this job.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to release lock "${jobName}": ${err instanceof Error ? err.message : String(err)}. ` +
          `It will expire via TTL.`,
      );
    }
  }
}
