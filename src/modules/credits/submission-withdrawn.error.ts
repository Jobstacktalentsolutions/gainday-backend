export class SubmissionWithdrawnError extends Error {
  constructor() {
    super('This candidate has withdrawn their application');
  }
}
