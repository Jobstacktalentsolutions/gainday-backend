import { and, isNotNull, ne } from 'drizzle-orm';
import { submissions, SubmissionStatus } from '../../db/schema';

export const employerVisibleSubmission = () =>
  and(ne(submissions.status, SubmissionStatus.WITHDRAWN), isNotNull(submissions.completedAt));
