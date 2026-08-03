/**
 * What this container is actually allowed to use — CPU and memory.
 *
 * ## Why `os.cpus()` is the wrong answer
 *
 * Inside a container, `os.cpus().length` reports the **host's** core count, not
 * the share this container was granted. On a 16-core host with a 0.5-CPU limit
 * it returns 16. PM2's `instances: 'max'` is built on exactly that number, so it
 * would fork 16 workers to fight over half a core — and open 16× the Mongo
 * connections that were budgeted for.
 *
 * The real limit lives in the cgroup filesystem, which is what this module
 * reads. Getting it from there means the same image is correctly sized on a
 * free 0.1-CPU instance and on an 8-core production one, with nothing to edit
 * between them. That is the point: the plan changes in a dashboard, not in the
 * repo.
 *
 * ## Where the numbers come from
 *
 * - **cgroup v2** (`/sys/fs/cgroup/cpu.max`): `"<quota> <period>"`, or
 *   `"max <period>"` when unlimited. CPUs = quota ÷ period.
 * - **cgroup v1** (`/sys/fs/cgroup/cpu/cpu.cfs_quota_us` + `cpu.cfs_period_us`):
 *   same ratio, quota of `-1` meaning unlimited.
 * - Neither present (bare metal, macOS, Windows dev) → fall back to
 *   `os.cpus().length`.
 *
 * Everything here fails soft. A misread limit must never stop the process from
 * booting; the fallbacks are conservative, and under-using a core is recoverable
 * in a way that exhausting the database is not.
 */

import * as fs from 'fs';
import * as os from 'os';

/** cgroup v2 unified CPU limit. */
const CGROUP_V2_CPU_MAX = '/sys/fs/cgroup/cpu.max';
/** cgroup v1 CPU quota and period. */
const CGROUP_V1_CPU_QUOTA = '/sys/fs/cgroup/cpu/cpu.cfs_quota_us';
const CGROUP_V1_CPU_PERIOD = '/sys/fs/cgroup/cpu/cpu.cfs_period_us';
/** cgroup memory limits. */
const CGROUP_V2_MEMORY_MAX = '/sys/fs/cgroup/memory.max';
const CGROUP_V1_MEMORY_MAX = '/sys/fs/cgroup/memory/memory.limit_in_bytes';

/**
 * A cgroup v1 "unlimited" memory limit is a sentinel close to 2^63, not a real
 * number. Anything above this is treated as "no limit configured".
 */
const UNLIMITED_MEMORY_THRESHOLD = 2 ** 53;

/** Reads a file, returning undefined for any failure. */
function readOptional(path: string): string | undefined {
  try {
    return fs.readFileSync(path, 'utf8').trim();
  } catch {
    return undefined;
  }
}

/**
 * Parses a cgroup v2 `cpu.max` value into a CPU count.
 *
 * Exported for tests: the parsing is the part with edge cases, and it cannot be
 * exercised through the filesystem on a dev machine that has no cgroups.
 */
export function parseCgroupV2Cpu(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const [quota, period] = raw.split(/\s+/);

  // "max" means no quota — the container may use the whole host.
  if (quota === undefined || quota === 'max') {
    return undefined;
  }

  const quotaNum = Number.parseInt(quota, 10);
  const periodNum = Number.parseInt(period ?? '', 10);

  if (!Number.isFinite(quotaNum) || !Number.isFinite(periodNum) || periodNum <= 0) {
    return undefined;
  }

  return quotaNum / periodNum;
}

/** Parses cgroup v1 quota/period pair into a CPU count. */
export function parseCgroupV1Cpu(
  quotaRaw: string | undefined,
  periodRaw: string | undefined,
): number | undefined {
  if (quotaRaw === undefined || periodRaw === undefined) {
    return undefined;
  }

  const quota = Number.parseInt(quotaRaw, 10);
  const period = Number.parseInt(periodRaw, 10);

  // -1 is v1's "unlimited".
  if (!Number.isFinite(quota) || quota <= 0 || !Number.isFinite(period) || period <= 0) {
    return undefined;
  }

  return quota / period;
}

/**
 * CPUs available to this container, as a fraction (0.1 on a free instance).
 *
 * Not rounded here — the caller decides what to do with a fractional core, and
 * rounding early would turn 0.1 into either 0 (unusable) or 1 (a lie).
 */
export function detectCpuLimit(): number {
  const v2 = parseCgroupV2Cpu(readOptional(CGROUP_V2_CPU_MAX));
  if (v2 !== undefined) {
    return v2;
  }

  const v1 = parseCgroupV1Cpu(
    readOptional(CGROUP_V1_CPU_QUOTA),
    readOptional(CGROUP_V1_CPU_PERIOD),
  );
  if (v1 !== undefined) {
    return v1;
  }

  // No cgroup limit: bare metal, or a container with unrestricted CPU.
  return os.cpus().length;
}

/** Memory ceiling in bytes, or undefined when unrestricted. */
export function detectMemoryLimitBytes(): number | undefined {
  for (const path of [CGROUP_V2_MEMORY_MAX, CGROUP_V1_MEMORY_MAX]) {
    const raw = readOptional(path);
    if (raw === undefined || raw === 'max') {
      continue;
    }

    const bytes = Number.parseInt(raw, 10);
    if (Number.isFinite(bytes) && bytes > 0 && bytes < UNLIMITED_MEMORY_THRESHOLD) {
      return bytes;
    }
  }

  return undefined;
}

/**
 * How many cluster workers to fork.
 *
 * @param explicit  `WEB_CONCURRENCY`, which always wins. Detection is a good
 *                  default, not a policy — an operator who has measured their
 *                  workload must be able to override it without editing code.
 *
 * The floor is 1 and the rule is deliberately conservative: **below two whole
 * CPUs, cluster mode is a net loss.** The workers contend for the same fraction
 * of a core, PM2's daemon costs memory that a small instance does not have, and
 * every worker multiplies the Mongo connection pool. One process is genuinely
 * faster there, so a free or 1-CPU instance gets exactly one.
 */
export function resolveClusterInstances(explicit?: string): number {
  const parsed = Number.parseInt(explicit ?? '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const cpus = detectCpuLimit();

  // Fractional or single CPU — forking gains nothing and costs memory.
  if (!Number.isFinite(cpus) || cpus < 2) {
    return 1;
  }

  return Math.floor(cpus);
}

/**
 * PM2's `max_memory_restart`, as a string like `"384M"`.
 *
 * Sized from the container's own limit rather than hardcoded. A fixed `1G` is
 * wrong in both directions: on a 512 MB instance the process is OOM-killed by
 * the kernel long before PM2 ever intervenes — losing every in-flight request
 * with no graceful shutdown — while on an 8 GB instance it restarts a healthy
 * process that had plenty of headroom left.
 *
 * @param fraction  share of the limit at which to recycle. The default leaves
 *                  room for the restart itself to happen: at the moment PM2
 *                  forks a replacement, both processes are briefly resident.
 */
export function resolveMaxMemoryRestart(fraction = 0.75, fallback = '512M'): string {
  const limit = detectMemoryLimitBytes();
  if (limit === undefined) {
    return fallback;
  }

  const megabytes = Math.floor((limit * fraction) / (1024 * 1024));

  // Below this PM2 would restart-loop on startup allocation alone.
  return megabytes >= 128 ? `${megabytes}M` : fallback;
}

/**
 * V8's old-space ceiling for one worker, in MB.
 *
 * This has to be derived, and it is the setting most likely to be wrong.
 * `--max-old-space-size` is a promise to V8 about how much heap it may use
 * before collecting aggressively. Promise more than the container has and V8
 * cheerfully grows past the cgroup limit — at which point the **kernel** kills
 * the process, instantly, with no graceful shutdown and no chance to drain
 * in-flight requests. A hardcoded 2048 on a 512 MB instance is not a
 * performance setting, it is a scheduled `SIGKILL`.
 *
 * Divided by `instances`, because every cluster worker gets its own heap and
 * they all draw on the same container limit.
 *
 * @param instances  cluster workers sharing the container.
 * @param fraction   share of the limit for JS heap, leaving room for the Node
 *                   binary, native buffers and PM2's own daemon.
 */
export function resolveOldSpaceMb(instances: number, fraction = 0.6, fallback = 512): number {
  const limit = detectMemoryLimitBytes();
  const workers = Number.isFinite(instances) && instances > 0 ? instances : 1;

  if (limit === undefined) {
    return fallback;
  }

  const perWorker = Math.floor((limit * fraction) / (1024 * 1024) / workers);

  // Node needs a workable floor; below ~128 MB it thrashes GC and stalls.
  return perWorker >= 128 ? perWorker : 128;
}
