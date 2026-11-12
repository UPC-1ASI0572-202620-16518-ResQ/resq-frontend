import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthSessionStore } from './auth-session.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionStore = inject(AuthSessionStore);
  const token = sessionStore.token();
  const authenticatedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (isUnauthorized(error)) sessionStore.clear();
      return throwError(() => error);
    }),
  );
};

function isUnauthorized(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 401);
}
