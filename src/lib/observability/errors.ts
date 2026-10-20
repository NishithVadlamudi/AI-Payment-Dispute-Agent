export class TraceUnavailableError extends Error {
  constructor() {
    super('The run details could not be saved. Check the approval queue for any requests already created before retrying.');
  }
}
