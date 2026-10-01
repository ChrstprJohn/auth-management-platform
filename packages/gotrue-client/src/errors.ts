export class UpstreamError extends Error {
  constructor(
    public readonly kind:
      | 'identity'
      | 'unavailable'
      | 'not_found'
      | 'rejected'
      | 'conflict',
    public readonly ambiguous = false,
  ) {
    super('GoTrue request failed');
  }
}
