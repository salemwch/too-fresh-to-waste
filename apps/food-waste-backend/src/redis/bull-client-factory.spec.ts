/**
 * Bull's connection roles, and why sharing them is not uniform.
 *
 * Bull opens three connections per queue by default. At four queues that is
 * twelve, and with the Socket.IO adapter, RedisService and the throttler on top
 * a single process asked for roughly sixteen. Production hit its provider's
 * limit and could not boot:
 *
 *   ERROR [RedisService] Redis error: ERR max number of clients reached
 *
 * The failure exits the process; PM2 restarts it; the replacement asks for
 * sixteen more while the killed process's sockets are still held. The shortage
 * compounds per restart, so the loop cannot clear on its own.
 *
 * The sharing rules are asymmetric and a wrong guess fails quietly rather than
 * loudly — a `bclient` that inherits `commandTimeout` aborts its blocking read,
 * and the queue simply stops consuming. Nothing throws. So each rule is pinned
 * here rather than left to the comment.
 *
 * ioredis is mocked: these assertions are about which options reach the
 * constructor and how many instances are built, and a real connection would
 * make that unobservable while also requiring a Redis server.
 */

jest.mock('ioredis', () => {
  const instances: Array<Record<string, unknown>> = [];
  const MockRedis = jest.fn().mockImplementation((options: Record<string, unknown>) => {
    const instance = { options, id: instances.length };
    instances.push(instance);
    return instance;
  });
  return { __esModule: true, default: MockRedis, __instances: instances };
});

import IORedis from 'ioredis';

import { createBullClientFactory, type RedisConnectionConfig } from './redis.config';

const CONFIG: RedisConnectionConfig = {
  host: 'redis.example.com',
  port: 6379,
  password: 'secret',
  useTls: false,
  rejectUnauthorized: true,
  checkServerIdentity: true,
  connectTimeout: 10_000,
  commandTimeout: 5_000,
  maxRetries: 10,
};

/** Options handed to the ioredis constructor on the Nth call. */
const optionsOfCall = (n: number): Record<string, unknown> =>
  (IORedis as unknown as jest.Mock).mock.calls[n]?.[0] as Record<string, unknown>;

beforeEach(() => {
  (IORedis as unknown as jest.Mock).mockClear();
});

describe('createBullClientFactory', () => {
  describe('sharing', () => {
    it('hands every queue the same client connection', () => {
      const createClient = createBullClientFactory(CONFIG);

      const first = createClient('client');
      const second = createClient('client');

      expect(second).toBe(first);
      expect(IORedis).toHaveBeenCalledTimes(1);
    });

    it('hands every queue the same subscriber connection', () => {
      const createClient = createBullClientFactory(CONFIG);

      const first = createClient('subscriber');
      const second = createClient('subscriber');

      expect(second).toBe(first);
      expect(IORedis).toHaveBeenCalledTimes(1);
    });

    it('gives each queue its own bclient', () => {
      // Blocking reads hold a connection for their whole duration. Sharing one
      // would serialise every queue behind whichever blocked first, which is a
      // stall rather than an error — no exception, just jobs that stop moving.
      const createClient = createBullClientFactory(CONFIG);

      const first = createClient('bclient');
      const second = createClient('bclient');

      expect(second).not.toBe(first);
      expect(IORedis).toHaveBeenCalledTimes(2);
    });

    it('opens nothing until a queue actually asks', () => {
      createBullClientFactory(CONFIG);

      expect(IORedis).not.toHaveBeenCalled();
    });

    it('opens six connections for four queues instead of twelve', () => {
      // The whole point: 3n becomes n + 2.
      const createClient = createBullClientFactory(CONFIG);

      for (let queue = 0; queue < 4; queue += 1) {
        createClient('client');
        createClient('subscriber');
        createClient('bclient');
      }

      expect(IORedis).toHaveBeenCalledTimes(6);
    });
  });

  describe('options per role', () => {
    it('keeps commandTimeout on the ordinary client', () => {
      const createClient = createBullClientFactory(CONFIG);

      createClient('client');

      expect(optionsOfCall(0)['commandTimeout']).toBe(5_000);
    });

    it.each(['subscriber', 'bclient'] as const)(
      'drops commandTimeout for %s, which is meant to sit idle',
      role => {
        // A blocking read waiting for work is not a stuck command. With a
        // timeout it is aborted and the queue quietly stops consuming.
        const createClient = createBullClientFactory(CONFIG);

        createClient(role);

        expect(optionsOfCall(0)).not.toHaveProperty('commandTimeout');
      },
    );

    it.each(['subscriber', 'bclient'] as const)(
      'sets maxRetriesPerRequest to null for %s, as ioredis requires',
      role => {
        const createClient = createBullClientFactory(CONFIG);

        createClient(role);

        expect(optionsOfCall(0)['maxRetriesPerRequest']).toBeNull();
        expect(optionsOfCall(0)['enableReadyCheck']).toBe(false);
      },
    );

    it('carries connection details through to every role', () => {
      // Sharing must not quietly drop credentials or host details.
      const createClient = createBullClientFactory(CONFIG);

      createClient('bclient');

      expect(optionsOfCall(0)).toMatchObject({
        host: 'redis.example.com',
        port: 6379,
        password: 'secret',
      });
    });
  });

  it('rejects a connection role it does not recognise', () => {
    // Bull only asks for the three. A fourth means the library changed, and
    // guessing a connection shape would be worse than failing loudly.
    const createClient = createBullClientFactory(CONFIG);

    expect(() => createClient('unexpected' as 'client')).toThrow(/Unsupported Bull client type/);
  });
});
