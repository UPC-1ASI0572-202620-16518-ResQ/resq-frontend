import { HttpErrorResponse } from '@angular/common/http';
import { mapHttpError } from './http-error.mapper';

describe('mapHttpError', () => {
  it('explains an HTTP 500 instead of treating it as an empty result', () => {
    const mapped = mapHttpError(new HttpErrorResponse({
      status: 500,
      statusText: 'Internal Server Error',
      error: {},
    }));

    expect(mapped.status).toBe(500);
    expect(mapped.code).toBe('SERVER_ERROR');
    expect(mapped.message).toContain('internal error');
    expect(mapped.message).toContain('not replaced');
  });
});
