import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { API_CONFIG, ApiConfig, buildApiUrl } from '../../../core/api/api.config';
import { mapHttpError } from '../../../core/api/http-error.mapper';
import { SubscriptionGateway, SubscriptionRecord, CreateSubscriptionInput, RenewSubscriptionInput } from './subscription.gateway';
import { SubscriptionResourceDto } from './subscription.dto';
import { mapSubscriptionResourceDto } from './subscription.mapper';

@Injectable()
export class HttpSubscriptionGateway implements SubscriptionGateway {
  private readonly basePath = '/api/v1/subscriptions';

  constructor(
    private readonly http: HttpClient,
    @Inject(API_CONFIG) private readonly apiConfig: ApiConfig
  ) {}

  getMySubscription(): Observable<SubscriptionRecord | undefined> {
    return this.http.get<SubscriptionResourceDto>(buildApiUrl(this.apiConfig, this.basePath)).pipe(
      map(mapSubscriptionResourceDto),
      catchError(error => {
        const mapped = mapHttpError(error);
        return mapped.status === 404 ? of(undefined) : throwError(() => mapped);
      })
    );
  }

  createSubscription(input: CreateSubscriptionInput): Observable<SubscriptionRecord> {
    return this.http.post<SubscriptionResourceDto>(buildApiUrl(this.apiConfig, this.basePath), {
      startDate: input.startDate.toISOString(),
      endDate: input.endDate.toISOString()
    }).pipe(
      map(mapSubscriptionResourceDto),
      catchError(error => throwError(() => mapHttpError(error)))
    );
  }

  renewSubscription(id: string, input: RenewSubscriptionInput): Observable<SubscriptionRecord> {
    return this.http.put<SubscriptionResourceDto>(buildApiUrl(this.apiConfig, `${this.basePath}/${id}/renew`), {
      newEndDate: input.newEndDate.toISOString()
    }).pipe(
      map(mapSubscriptionResourceDto),
      catchError(error => throwError(() => mapHttpError(error)))
    );
  }

  cancelSubscription(id: string): Observable<SubscriptionRecord> {
    return this.http.put<SubscriptionResourceDto>(buildApiUrl(this.apiConfig, `${this.basePath}/${id}/cancel`), {}).pipe(
      map(mapSubscriptionResourceDto),
      catchError(error => throwError(() => mapHttpError(error)))
    );
  }

  expireSubscription(id: string): Observable<SubscriptionRecord> {
    return this.http.put<SubscriptionResourceDto>(buildApiUrl(this.apiConfig, `${this.basePath}/${id}/expire`), {}).pipe(
      map(mapSubscriptionResourceDto),
      catchError(error => throwError(() => mapHttpError(error)))
    );
  }
}
