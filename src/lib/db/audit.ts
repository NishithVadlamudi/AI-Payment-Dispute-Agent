export class AuditUnavailableError extends Error {
  constructor() {
    super('The audit log is unavailable. The agent stopped. Check the approval queue for any requests already created before retrying.');
  }
}
