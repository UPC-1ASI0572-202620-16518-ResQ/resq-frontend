export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors: ApiFieldError[];
  traceId?: string;
  details?: unknown;
}

export function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ApiError>;

  return (
    typeof candidate.status === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    Array.isArray(candidate.fieldErrors)
  );
}