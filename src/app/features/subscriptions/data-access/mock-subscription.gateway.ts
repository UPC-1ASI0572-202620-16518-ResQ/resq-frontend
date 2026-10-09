import { Injectable, signal } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { SubscriptionGateway, SubscriptionRecord, CreateSubscriptionInput, RenewSubscriptionInput } from './subscription.gateway';

@Injectable()
export class MockSubscriptionGateway implements SubscriptionGateway {
  private readonly current = signal<SubscriptionRecord | undefined>(undefined);

  getMySubscription(): Observable<SubscriptionRecord | undefined> {
    return of(this.current()).pipe(delay(60));
  }

  createSubscription(input: CreateSubscriptionInput): Observable<SubscriptionRecord> {
    const existing = this.current();
    if (existing && existing.status === 'ACTIVE') {
      return throwError(() => this.conflict('La organización ya posee una suscripción.'));
    }
    const sub: SubscriptionRecord = {
      id: crypto.randomUUID(),
      organizationId: 'local-org',
      status: 'ACTIVE',
      startDate: input.startDate,
      endDate: input.endDate
    };
    this.current.set(sub);
    return of(sub).pipe(delay(90));
  }

  renewSubscription(id: string, input: RenewSubscriptionInput): Observable<SubscriptionRecord> {
    const sub = this.current();
    if (!sub || sub.id !== id) return throwError(() => this.notFound());
    const updated: SubscriptionRecord = { ...sub, endDate: input.newEndDate, status: 'ACTIVE' };
    this.current.set(updated);
    return of(updated).pipe(delay(90));
  }

  cancelSubscription(id: string): Observable<SubscriptionRecord> {
    const sub = this.current();
    if (!sub || sub.id !== id) return throwError(() => this.notFound());
    const updated: SubscriptionRecord = { ...sub, status: 'CANCELLED' };
    this.current.set(updated);
    return of(updated).pipe(delay(90));
  }

  expireSubscription(id: string): Observable<SubscriptionRecord> {
    const sub = this.current();
    if (!sub || sub.id !== id) return throwError(() => this.notFound());
    const updated: SubscriptionRecord = { ...sub, status: 'EXPIRED' };
    this.current.set(updated);
    return of(updated).pipe(delay(90));
  }

  private notFound(): ApiError {
    return { status: 404, code: 'NOT_FOUND', message: 'Suscripción no encontrada', fieldErrors: [] };
  }

  private conflict(message: string): ApiError {
    return { status: 409, code: 'CONFLICT', message, fieldErrors: [] };
  }
}
