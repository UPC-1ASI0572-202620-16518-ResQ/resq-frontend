import { Inject, Injectable, computed, signal } from '@angular/core';
import { Observable, catchError, finalize, tap, throwError } from 'rxjs';
import { ApiError, isApiError } from '../../../core/api/api-error';
import { SUBSCRIPTION_GATEWAY, SubscriptionGateway, SubscriptionRecord, CreateSubscriptionInput, RenewSubscriptionInput } from './subscription.gateway';

@Injectable({ providedIn: 'root' })
export class SubscriptionFacade {
  private readonly subState = signal<SubscriptionRecord | undefined>(undefined);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<ApiError | undefined>(undefined);

  readonly subscription = this.subState.asReadonly();
  readonly isActive = computed(() => this.subState()?.status === 'ACTIVE');
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor(@Inject(SUBSCRIPTION_GATEWAY) private readonly gateway: SubscriptionGateway) {}

  loadMySubscription(): Observable<SubscriptionRecord | undefined> {
    this.loadingState.set(true);
    this.errorState.set(undefined);
    return this.gateway.getMySubscription().pipe(
      tap(sub => this.subState.set(sub)),
      catchError(err => this.fail(err)),
      finalize(() => this.loadingState.set(false))
    );
  }

  activate(input: CreateSubscriptionInput): Observable<SubscriptionRecord> {
    return this.mutate(this.gateway.createSubscription(input));
  }

  renew(id: string, input: RenewSubscriptionInput): Observable<SubscriptionRecord> {
    return this.mutate(this.gateway.renewSubscription(id, input));
  }

  cancel(id: string): Observable<SubscriptionRecord> {
    return this.mutate(this.gateway.cancelSubscription(id));
  }

  private mutate(operation: Observable<SubscriptionRecord>): Observable<SubscriptionRecord> {
    this.loadingState.set(true);
    this.errorState.set(undefined);
    return operation.pipe(
      tap(sub => this.subState.set(sub)),
      catchError(err => this.fail(err)),
      finalize(() => this.loadingState.set(false))
    );
  }

  private fail(error: unknown): Observable<never> {
    const apiError: ApiError = isApiError(error) ? error : { status: 0, code: 'CLIENT_ERROR', message: error instanceof Error ? error.message : 'Error', fieldErrors: [] };
    this.errorState.set(apiError);
    return throwError(() => apiError);
  }
}
