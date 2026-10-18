import { AdminNotificationsService } from './admin-notifications.service';
import type { NotificationsService } from './notifications.service';
import type { DrizzleDb } from '../../db/client';

const stored = {
  id: 'n1',
  severity: 'CRITICAL',
  type: 'GRADING_FAILED',
  title: 'Grading failed',
  message: 'Submission GD-ABC123 could not be graded.',
  details: 'quota exceeded',
  metadata: null,
  readAt: null,
};

// Only the two query shapes create() uses: insert().values().returning() for the notification
// and select().from().where() for the admin recipients.
function buildDb(notification: object, adminEmails: string[]) {
  return {
    insert: () => ({
      values: () => ({ returning: () => Promise.resolve([notification]) }),
    }),
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(adminEmails.map((email) => ({ email }))),
      }),
    }),
  } as unknown as DrizzleDb;
}

describe('AdminNotificationsService.create', () => {
  const input = {
    severity: 'CRITICAL' as const,
    type: 'GRADING_FAILED',
    title: 'Grading failed',
    message: 'Submission GD-ABC123 could not be graded.',
    details: 'quota exceeded',
  };

  it('emails every active admin for a CRITICAL notification', async () => {
    const sendAdminCriticalAlertEmail = jest.fn().mockResolvedValue(undefined);
    const service = new AdminNotificationsService(
      buildDb(stored, ['a@gainday.com', 'b@gainday.com']),
      { sendAdminCriticalAlertEmail } as unknown as NotificationsService,
    );

    const result = await service.create(input);

    expect(result.id).toBe('n1');
    expect(sendAdminCriticalAlertEmail).toHaveBeenCalledTimes(2);
    expect(sendAdminCriticalAlertEmail).toHaveBeenCalledWith(
      'a@gainday.com',
      expect.objectContaining({
        severity: 'CRITICAL',
        details: 'quota exceeded',
      }),
    );
  });

  it('does not email for lower severities', async () => {
    const sendAdminCriticalAlertEmail = jest.fn();
    const service = new AdminNotificationsService(
      buildDb({ ...stored, severity: 'WARNING' }, ['a@gainday.com']),
      { sendAdminCriticalAlertEmail } as unknown as NotificationsService,
    );

    await service.create({ ...input, severity: 'WARNING' });

    expect(sendAdminCriticalAlertEmail).not.toHaveBeenCalled();
  });

  it('still returns the notification when the email fails', async () => {
    const sendAdminCriticalAlertEmail = jest
      .fn()
      .mockRejectedValue(new Error('queue down'));
    const service = new AdminNotificationsService(
      buildDb(stored, ['a@gainday.com']),
      { sendAdminCriticalAlertEmail } as unknown as NotificationsService,
    );

    await expect(service.create(input)).resolves.toMatchObject({ id: 'n1' });
  });
});
