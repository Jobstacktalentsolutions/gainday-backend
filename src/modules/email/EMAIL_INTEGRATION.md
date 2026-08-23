# Email Integration Guide

This document explains how to use the email integration system with Bull MQ, EJS templates, and Brevo.

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
# Brevo Email Service
BREVO_API_KEY=your_brevo_api_key_here
EMAIL_FROM=noreply@gainday.com
EMAIL_FROM_NAME=Gainday
APP_URL=http://localhost:3000
```

Get your Brevo API key from: https://www.brevo.com/

### 2. Module Integration

The `EmailModule` is already integrated in `app.module.ts` and provides:
- `EmailService` - Template rendering and email sending
- `EmailQueueService` - Queue management for async email delivery
- `EmailProcessor` - Bull MQ processor for handling jobs

## Usage Examples

### Single Email with Template

```typescript
import { EmailQueueService } from './modules/email/email-queue.service';

constructor(private emailQueueService: EmailQueueService) {}

// Queue an email job
await this.emailQueueService.enqueueEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome',
  context: {
    firstName: 'John',
    appUrl: 'http://localhost:3000',
    year: 2025,
  },
});
```

### Batch Email

```typescript
// Send to multiple recipients
await this.emailQueueService.enqueueBatchEmail(
  ['user1@example.com', 'user2@example.com'],
  'New Submissions',
  'batch-submission-notification',
  {
    candidateCount: 5,
    jobTitle: 'Software Engineer',
    jobId: '123',
    appUrl: 'http://localhost:3000',
    year: 2025,
  }
);
```

### Check Job Status

```typescript
const status = await this.emailQueueService.getJobStatus(jobId);
console.log(status);
// {
//   id: '1',
//   state: 'completed',
//   progress: 100,
//   data: { ... },
//   result: { success: true },
//   failedReason: null,
//   attempts: 1,
//   delay: 0
// }
```

### Queue with Delay

```typescript
// Send email after 5 minutes
const delayMs = 5 * 60 * 1000;

await this.emailQueueService.enqueueEmail({
  to: 'user@example.com',
  subject: 'Reminder',
  template: 'password-reset',
  context: { resetLink: 'http://...', year: 2025 },
}, delayMs);
```

## Email Templates

Templates are located in `src/templates/emails/` and use EJS syntax.

### Available Templates

#### 1. welcome.ejs
Welcome email for new users.

**Context variables:**
- `firstName` - User's first name
- `appUrl` - Application URL
- `year` - Current year

#### 2. password-reset.ejs
Password reset/verification email.

**Context variables:**
- `resetLink` - Reset link URL
- `expiryHours` - Link expiration time
- `year` - Current year

#### 3. batch-submission-notification.ejs
Notification for new job submissions.

**Context variables:**
- `candidateCount` - Number of new submissions
- `jobTitle` - Job title
- `jobId` - Job ID
- `appUrl` - Application URL
- `year` - Current year

### Creating Custom Templates

1. Create a new `.ejs` file in `src/templates/emails/`
2. Use EJS syntax for dynamic content
3. Example: `src/templates/emails/custom.ejs`

```ejs
<!DOCTYPE html>
<html>
  <head>
    <title><%= title %></title>
  </head>
  <body>
    <h1><%= greeting %></h1>
    <p>Custom content here</p>
  </body>
</html>
```

4. Use in your service:

```typescript
await this.emailQueueService.enqueueEmail({
  to: 'user@example.com',
  subject: 'Custom Email',
  template: 'custom',
  context: {
    title: 'My Custom Email',
    greeting: 'Hello User!',
  },
});
```

## NotificationsService Integration

The `NotificationsService` is updated to use the email queue:

```typescript
// In any service that depends on NotificationsService
constructor(private notificationsService: NotificationsService) {}

// Send verification email
await this.notificationsService.sendVerificationEmail('user@example.com', 'token123');

// Send password reset
await this.notificationsService.sendPasswordResetEmail('user@example.com', 'token123');

// Send batch submission notification
await this.notificationsService.sendBatchNotification(
  'employer@example.com',
  5,
  'Software Engineer Position'
);
```

## Email Job Processing

Bull MQ processes emails in the background:

1. **Job Enqueuing** - Email data added to Redis queue
2. **Job Processing** - Processor renders template and sends via Brevo
3. **Retry Logic** - Failed jobs retry up to 3 times with exponential backoff
4. **Cleanup** - Successful jobs are automatically removed from queue

### Monitoring Jobs

```typescript
// Get queue stats
const waiting = await emailQueue.getWaitingCount();
const active = await emailQueue.getActiveCount();
const completed = await emailQueue.getCompletedCount();
const failed = await emailQueue.getFailedCount();

console.log({ waiting, active, completed, failed });
```

## Error Handling

Emails that fail are logged with details. Check your application logs:

```
[EmailService] Failed to send email: ...
[EmailProcessor] Email job {jobId} failed: ...
```

Failed jobs are retained for debugging and can be manually retried via Bull MQ admin panel.

## Best Practices

1. **Always use the queue** - Never call `emailService.sendEmail()` directly in request handlers
2. **Set appropriate delays** - Use delays for time-sensitive notifications
3. **Test templates** - Render templates locally before deploying
4. **Monitor failed jobs** - Set up alerts for consistently failing jobs
5. **Batch when possible** - Use batch emails for notifications to many users
6. **Add context** - Provide enough context for emails to be self-contained

## Debugging

### Template Rendering Issues

```typescript
// Test template rendering
const html = await this.emailService.renderTemplate('welcome', {
  firstName: 'John',
  appUrl: 'http://localhost:3000',
  year: 2025,
});
console.log(html); // Check rendered output
```

### Job Failed?

1. Check application logs for error details
2. Verify template file exists at `src/templates/emails/{name}.ejs`
3. Ensure all required context variables are provided
4. Test Brevo API key validity

### Redis Connection Issues

1. Verify Redis is running and accessible
2. Check `REDIS_URL` environment variable
3. Verify connection credentials in `.env`
