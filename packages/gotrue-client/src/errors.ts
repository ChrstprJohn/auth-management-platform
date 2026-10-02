export class UpstreamError extends Error {
  constructor(
    public readonly kind:
      | 'identity'
      | 'rate_limited'
      | 'same_password'
      | 'weak_password'
      | 'unavailable'
      | 'not_found'
      | 'rejected'
      | 'conflict',
    public readonly ambiguous = false,
  ) {
    super('GoTrue request failed');
  }
}
