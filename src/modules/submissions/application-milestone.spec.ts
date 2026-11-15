import { SubmissionsService } from './submissions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailQueueService } from '../email/email-queue.service';
import * as ejs from 'ejs';
import * as path from 'path';

describe('application milestone notifications', () => {
  function setup(count: number) {
    const notify = jest.fn().mockResolvedValue(undefined);
    const db = {
      select: () => ({ from: () => ({ where: async () => [{ value: count }] }) }),
      query: { jobs: { findFirst: jest.fn().mockResolvedValue({ title: 'Accountant', employer: { user: { email: 'owner@example.com' } } }) } },
    };
    const service = new SubmissionsService(db as never, {} as never, {} as never, {} as never, {} as never, {} as never, { sendBatchNotification: notify } as never);
    return { service, notify };
  }

  it('queues no milestone below five and queues each reached multiple of five', async () => {
    const below = setup(4);
    await (below.service as any).notifyApplicationMilestones('job-1');
    expect(below.notify).not.toHaveBeenCalled();
    const ten = setup(10);
    await (ten.service as any).notifyApplicationMilestones('job-1');
    expect(ten.notify.mock.calls.map(call => call[1])).toEqual([5, 10]);
  });

  it('uses stable per-job and per-milestone queue IDs and renders the job link', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'queued' });
    const queue = new EmailQueueService({ add } as never);
    const config = { get: () => 'https://example.test' };
    const notifications = new NotificationsService(config as never, queue);
    await notifications.sendBatchNotification('owner@example.com', 5, 'Accountant', 'job-123');
    expect(add.mock.calls[0][2]).toMatchObject({ jobId: 'application-milestone-job-123-5', removeOnComplete: false });
    const payload = add.mock.calls[0][1];
    const template = path.join(process.cwd(), 'src/templates/emails/batch-submission-notification.ejs');
    const html = await ejs.renderFile(template, { ...payload.context, logoUrl: 'https://example.test/logo.png' });
    expect(html).toContain('https://example.test/employer/jobs/job-123/submissions');
    expect(html).toContain('Applications received');
  });
});
