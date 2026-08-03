/**
 * Durable notification delivery.
 *
 * Email (Resend) and push (FCM) are third-party HTTP calls. Sent inline from a
 * request they made their provider's availability ours, and a failure had
 * nowhere to go — the caller's `.catch()` logged it and the notification was
 * lost with no retry and no record. In a food-waste marketplace a missed pickup
 * notification is a wasted meal and a refund.
 *
 * These tests pin the two halves of the fix: enqueueing must never break the
 * business operation that triggered it, and the processor must let Bull retry
 * real failures while not retrying non-failures.
 */

import { getQueueToken } from '@nestjs/bull';
import { Test } from '@nestjs/testing';

import { NOTIFICATION_JOB, NOTIFICATION_QUEUE } from '../notifications.constants';
import { NotificationProcessor } from '../processors/notification.processor';
import { NotificationService } from '../services/notification.service';

import type { ISendNotificationRequest } from '../interfaces/notification.interfaces';
import type { Job } from 'bull';
import type { TestingModule } from '@nestjs/testing';

const request: ISendNotificationRequest = {
  type: 'push',
  trigger: 'order_confirmed',
  target: { userId: 'user-1' },
  payload: { title: 'New Order', body: 'Pickup code: 123456' },
};

describe('NotificationService.queueNotification', () => {
  let service: NotificationService;
  let queue: { add: jest.Mock };
  let loggerError: jest.SpyInstance;

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    // Only the queue collaborator matters here; the rest of the constructor is
    // irrelevant to enqueueing, so the service is built on its prototype.
    service = Object.create(NotificationService.prototype) as NotificationService;
    Object.assign(service, {
      notificationQueue: queue,
      logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
    });

    loggerError = jest.spyOn(
      (service as unknown as { logger: { error: jest.Mock } }).logger,
      'error',
    );

    await Promise.resolve();
  });

  it('enqueues the request under the notification job name', async () => {
    await service.queueNotification(request);

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(NOTIFICATION_JOB, request, expect.anything());
  });

  it('attaches retry options so a provider blip is survivable', async () => {
    await service.queueNotification(request);

    const options = queue.add.mock.calls[0][2] as Record<string, unknown>;
    expect(options['attempts']).toBeGreaterThan(1);
    expect(options['backoff']).toEqual({ type: 'exponential', delay: 2000 });
  });

  it('bounds retained jobs so Redis does not grow without limit', async () => {
    // Bull keeps finished jobs forever by default. This is the highest-volume
    // queue in the system and shares Redis with the throttler, the cache and
    // the Socket.IO adapter — unbounded growth evicts live keys.
    await service.queueNotification(request);

    const options = queue.add.mock.calls[0][2] as Record<string, unknown>;
    expect(options['removeOnComplete']).toEqual(expect.any(Number));
    expect(options['removeOnFail']).toEqual(expect.any(Number));
  });

  it('keeps failures longer than successes — they are the evidence', () => {
    // A failed notification is the only record of a user who should have been
    // told something and was not.
    const { NOTIFICATION_JOB_OPTIONS } =
      require('../notifications.constants') as typeof import('../notifications.constants');

    expect(NOTIFICATION_JOB_OPTIONS.removeOnFail).toBeGreaterThan(
      NOTIFICATION_JOB_OPTIONS.removeOnComplete,
    );
  });

  it('does NOT throw when Redis is unreachable', async () => {
    // The critical property. This is called from order creation; throwing here
    // would fail an order that already committed, over a push notification.
    queue.add.mockRejectedValue(new Error('redis down'));

    await expect(service.queueNotification(request)).resolves.toBeUndefined();
  });

  it('logs the loss when enqueueing fails, rather than swallowing it silently', async () => {
    queue.add.mockRejectedValue(new Error('redis down'));

    await service.queueNotification(request);

    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(String(loggerError.mock.calls[0]?.[0])).toContain('order_confirmed');
  });
});

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let notificationService: { sendNotification: jest.Mock };

  const makeJob = (over: Partial<Job<ISendNotificationRequest>> = {}) =>
    ({
      data: request,
      attemptsMade: 1,
      opts: { attempts: 5 },
      ...over,
    }) as Job<ISendNotificationRequest>;

  beforeEach(async () => {
    notificationService = { sendNotification: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: NotificationService, useValue: notificationService },
        { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: { add: jest.fn() } },
      ],
    }).compile();

    processor = module.get(NotificationProcessor);
  });

  it('delegates to the same send path a direct caller uses', async () => {
    // Reimplementing dispatch here would give queued and direct sends different
    // preference checks and sanitisation — the classic source of "works when I
    // call it directly" bugs.
    notificationService.sendNotification.mockResolvedValue({ success: true });

    await processor.handleSend(makeJob());

    expect(notificationService.sendNotification).toHaveBeenCalledWith(request);
  });

  it('completes quietly on success', async () => {
    notificationService.sendNotification.mockResolvedValue({ success: true });

    await expect(processor.handleSend(makeJob())).resolves.toBeUndefined();
  });

  it('throws on failure so Bull retries', async () => {
    // Returning normally would mark the job complete and drop a notification
    // that never arrived — the exact failure mode the queue exists to fix.
    notificationService.sendNotification.mockResolvedValue({
      success: false,
      error: 'FCM unavailable',
    });

    await expect(processor.handleSend(makeJob())).rejects.toThrow('FCM unavailable');
  });

  it('throws with a fallback message when the failure carries no reason', async () => {
    notificationService.sendNotification.mockResolvedValue({ success: false });

    await expect(processor.handleSend(makeJob())).rejects.toThrow('Notification dispatch failed');
  });

  it('does NOT retry a send blocked by user preferences', async () => {
    // A correct outcome, not a failure. Retrying would hit the provider four
    // more times to reach the same decision.
    notificationService.sendNotification.mockResolvedValue({
      success: false,
      error: 'Blocked by user preferences',
    });

    await expect(processor.handleSend(makeJob())).resolves.toBeUndefined();
  });

  it('propagates a thrown dispatch error to Bull', async () => {
    notificationService.sendNotification.mockRejectedValue(new Error('network reset'));

    await expect(processor.handleSend(makeJob())).rejects.toThrow('network reset');
  });

  describe('failure logging', () => {
    it('warns while attempts remain', () => {
      const warn = jest.spyOn(
        (processor as unknown as { logger: { warn: jest.Mock } }).logger,
        'warn',
      );

      processor.onFailed(makeJob({ attemptsMade: 2 }), new Error('temporary'));

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('escalates to error once attempts are exhausted', () => {
      // The line that must be findable: a notification that will never arrive.
      const error = jest.spyOn(
        (processor as unknown as { logger: { error: jest.Mock } }).logger,
        'error',
      );

      processor.onFailed(makeJob({ attemptsMade: 5 }), new Error('permanent'));

      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0]?.[0])).toContain('permanently failed');
    });

    it('treats a missing attempts option as a single attempt', () => {
      const error = jest.spyOn(
        (processor as unknown as { logger: { error: jest.Mock } }).logger,
        'error',
      );

      processor.onFailed(
        makeJob({ attemptsMade: 1, opts: {} as Job['opts'] }),
        new Error('one shot'),
      );

      expect(error).toHaveBeenCalledTimes(1);
    });
  });
});
