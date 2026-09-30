import {
  HttpErrorResponse,
} from '@angular/common/http';

import {
  ApiError,
  ApiFieldError,
  isApiError,
} from './api-error';

interface BackendErrorPayload {
  code?: unknown;
  message?: unknown;
  traceId?: unknown;
  fieldErrors?: unknown;
  errors?: unknown;
  details?: unknown;
}

export function mapHttpError(
  error: unknown,
): ApiError {

  if (isApiError(error)) {
    return error;
  }

  if (
    !(error instanceof HttpErrorResponse)
  ) {
    return {
      status: 0,

      code:
        'CLIENT_ERROR',

      message:
        'An unexpected client error occurred.',

      fieldErrors: [],

      details:
        error,
    };
  }

  const payload =
    toBackendErrorPayload(
      error.error,
    );

  const status =
    error.status || 0;

  return {
    status,

    code:
      readString(payload.code) ??
      defaultCode(status),

    message:
      readString(payload.message) ??
      defaultMessage(status),

    fieldErrors:
      normalizeFieldErrors(
        payload.fieldErrors ??
        payload.errors,
      ),

    traceId:
      readString(
        payload.traceId,
      ),

    details:
      payload.details ??
      error.error,
  };
}

function toBackendErrorPayload(
  value: unknown,
): BackendErrorPayload {

  return value &&
    typeof value === 'object'
    ? value as BackendErrorPayload
    : {};
}

function readString(
  value: unknown,
): string | undefined {

  return (
    typeof value === 'string' &&
    value.trim().length > 0
  )
    ? value
    : undefined;
}

function normalizeFieldErrors(
  value: unknown,
): ApiFieldError[] {

  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {

    return value.flatMap(
      (item) =>
        normalizeFieldErrorItem(
          item,
        ),
    );
  }

  if (
    typeof value === 'object'
  ) {

    return Object.entries(
      value as Record<
        string,
        unknown
      >,
    ).flatMap(
      ([field, messages]) => {

        if (
          Array.isArray(messages)
        ) {

          return messages
            .filter(
              (
                message,
              ): message is string =>
                typeof message ===
                'string',
            )
            .map(
              (message) => ({
                field,
                message,
              }),
            );
        }

        return typeof messages ===
          'string'
          ? [
              {
                field,
                message:
                  messages,
              },
            ]
          : [];
      },
    );
  }

  return [];
}

function normalizeFieldErrorItem(
  value: unknown,
): ApiFieldError[] {

  if (
    !value ||
    typeof value !== 'object'
  ) {
    return [];
  }

  const candidate =
    value as {
      field?: unknown;
      message?: unknown;
    };

  const field =
    readString(
      candidate.field,
    );

  const message =
    readString(
      candidate.message,
    );

  return field && message
    ? [
        {
          field,
          message,
        },
      ]
    : [];
}

function defaultCode(
  status: number,
): string {

  switch (status) {

    case 0:
      return 'NETWORK_ERROR';

    case 400:
      return 'BAD_REQUEST';

    case 401:
      return 'UNAUTHORIZED';

    case 403:
      return 'FORBIDDEN';

    case 404:
      return 'NOT_FOUND';

    case 409:
      return 'CONFLICT';

    case 412:
      return 'PRECONDITION_FAILED';

    case 428:
      return 'PRECONDITION_REQUIRED';

    case 503:
      return 'SERVICE_UNAVAILABLE';

    default:
      return 'HTTP_ERROR';
  }
}

function defaultMessage(
  status: number,
): string {

  switch (status) {

    case 0:
      return (
        'The service is unreachable. ' +
        'Check your connection and try again.'
      );

    case 400:
      return (
        'The request contains invalid data.'
      );

    case 401:
      return (
        'Authentication is required.'
      );

    case 403:
      return (
        'You do not have permission ' +
        'to perform this action.'
      );

    case 404:
      return (
        'The requested resource ' +
        'was not found.'
      );

    case 409:
      return (
        'The request conflicts with ' +
        'the current resource state.'
      );

    case 412:
      return (
        'The resource changed before ' +
        'the operation could be completed.'
      );

    case 428:
      return (
        'The operation requires the ' +
        'latest resource version.'
      );

    case 503:
      return (
        'The service is temporarily unavailable.'
      );

    default:
      return (
        'The request could not be completed.'
      );
  }
}