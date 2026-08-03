/**
 * Sizing the process to the container it is actually in.
 *
 * These are the numbers that decide how many workers fork and how much Mongo
 * connection pool the service opens, and both are read from a cgroup file whose
 * format differs between v1 and v2 and has an "unlimited" sentinel in each. A
 * misparse does not throw — it silently returns a plausible-looking wrong
 * number, which is how a 0.1-CPU free instance ends up forking sixteen workers.
 *
 * The parsing is tested directly because it cannot be reached through the
 * filesystem on a dev machine with no cgroups.
 */

import {
  parseCgroupV1Cpu,
  parseCgroupV2Cpu,
  resolveClusterInstances,
  resolveMaxMemoryRestart,
  resolveOldSpaceMb,
} from '../container-resources';

describe('cgroup v2 CPU parsing', () => {
  it('reads a fractional limit', () => {
    // Render's free instance shape: a tenth of a core.
    expect(parseCgroupV2Cpu('10000 100000')).toBeCloseTo(0.1);
  });

  it('reads a whole-core limit', () => {
    expect(parseCgroupV2Cpu('400000 100000')).toBe(4);
  });

  it('treats "max" as no limit', () => {
    // Not zero. "max" means the container may use the whole host, so the caller
    // must fall through to os.cpus() rather than concluding it has no CPU.
    expect(parseCgroupV2Cpu('max 100000')).toBeUndefined();
  });

  it.each([
    ['', 'empty file'],
    ['garbage', 'non-numeric'],
    ['100000', 'quota with no period'],
    ['100000 0', 'zero period would divide by zero'],
    [undefined, 'file absent'],
  ])('returns undefined for %s (%s)', (raw: string | undefined, _reason: string) => {
    expect(parseCgroupV2Cpu(raw)).toBeUndefined();
  });
});

describe('cgroup v1 CPU parsing', () => {
  it('reads a quota/period pair', () => {
    expect(parseCgroupV1Cpu('50000', '100000')).toBeCloseTo(0.5);
  });

  it('treats -1 quota as no limit', () => {
    // v1's unlimited sentinel. Read naively it becomes a negative CPU count.
    expect(parseCgroupV1Cpu('-1', '100000')).toBeUndefined();
  });

  it.each([
    ['0', '100000', 'zero quota'],
    ['100000', '0', 'zero period'],
    ['abc', '100000', 'non-numeric quota'],
  ])('returns undefined for quota=%s period=%s (%s)', (quota, period) => {
    expect(parseCgroupV1Cpu(quota, period)).toBeUndefined();
  });
});

describe('resolveClusterInstances', () => {
  describe('explicit WEB_CONCURRENCY wins', () => {
    it('uses the value it is given', () => {
      // Detection is a default, not a policy: someone who has measured their
      // workload must be able to override without editing code.
      expect(resolveClusterInstances('6')).toBe(6);
    });

    it.each([
      ['0', 'zero would stop the service entirely'],
      ['-2', 'negative is meaningless'],
      ['abc', 'non-numeric'],
      ['', 'set but empty — a common way env vars arrive'],
      [undefined, 'unset'],
    ])('falls back to detection for %s (%s)', (raw: string | undefined, _reason: string) => {
      const result = resolveClusterInstances(raw);

      expect(result).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('detected', () => {
    it('never returns less than one', () => {
      // A fractional CPU must not floor to zero, which would fork no workers
      // and leave the service silently dead.
      expect(resolveClusterInstances()).toBeGreaterThanOrEqual(1);
    });

    it('returns a whole number of workers', () => {
      expect(Number.isInteger(resolveClusterInstances())).toBe(true);
    });
  });
});

describe('resolveMaxMemoryRestart', () => {
  it('returns a PM2-formatted size', () => {
    expect(resolveMaxMemoryRestart()).toMatch(/^\d+M$/);
  });

  it('falls back rather than returning a restart-loop threshold', () => {
    // A threshold below the process's own startup allocation makes PM2 restart
    // it forever — which presents as a crash-looping service, not as a memory
    // setting that is too low.
    const tiny = resolveMaxMemoryRestart(0.000001, '512M');

    expect(tiny).toBe('512M');
  });

  it('uses the supplied fallback when no limit can be read', () => {
    // On a dev machine with no cgroups this is the path actually taken.
    const result = resolveMaxMemoryRestart(0.75, '256M');

    expect(result).toMatch(/^\d+M$/);
  });
});

describe('resolveOldSpaceMb', () => {
  it('divides the budget between cluster workers', () => {
    // Every worker gets its own V8 heap and they share one container limit.
    // Sizing per-process against the whole limit overcommits by `instances`×.
    const one = resolveOldSpaceMb(1);
    const four = resolveOldSpaceMb(4);

    expect(four).toBeLessThanOrEqual(one);
  });

  it('never returns a heap too small for Node to run in', () => {
    // Below roughly 128 MB the process survives but thrashes GC, which reads as
    // "the server is mysteriously slow" rather than as a memory misconfiguration.
    expect(resolveOldSpaceMb(64)).toBeGreaterThanOrEqual(128);
  });

  it.each([
    [0, 'zero workers'],
    [-1, 'negative'],
    [Number.NaN, 'unparseable'],
  ])('treats %s (%s) as a single worker rather than dividing by it', instances => {
    // Dividing by zero yields Infinity, which formats into a flag V8 rejects —
    // the process would not boot at all.
    const result = resolveOldSpaceMb(instances);

    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(128);
  });
});
