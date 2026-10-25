import { NotificationsService } from './notifications.service';

describe('NotificationsService.sendVerificationEmail', () => {
  const configService = { get: jest.fn().mockReturnValue('https://app.example') };
  const emailQueueService = { enqueueEmail: jest.fn().mockResolvedValue('job-1') };
  let service: NotificationsService;

  const sentVerifyLink = () =>
    (emailQueueService.enqueueEmail.mock.calls[0][0] as { context: { verifyLink: string } })
      .context.verifyLink;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(configService as never, emailQueueService as never);
  });

  it('builds the verify link from the token alone when there is no redirect', async () => {
    await service.sendVerificationEmail('a@example.com', 'tok', 'EMPLOYER' as never);
    expect(sentVerifyLink()).toBe('https://app.example/employer/verify-email?token=tok');
  });

  it('carries the redirect in the link, encoded, so verification can return the employer', async () => {
    await service.sendVerificationEmail(
      'a@example.com',
      'tok',
      'EMPLOYER' as never,
      '/employer/billing?buy=GROWTH',
    );
    expect(sentVerifyLink()).toBe(
      'https://app.example/employer/verify-email?token=tok&redirect=%2Femployer%2Fbilling%3Fbuy%3DGROWTH',
    );
  });
});
