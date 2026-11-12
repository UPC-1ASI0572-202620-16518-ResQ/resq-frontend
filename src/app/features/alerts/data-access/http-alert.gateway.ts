import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import {
  Observable,
  catchError,
  forkJoin,
  map,
  of,
  switchMap,
  throwError,
} from 'rxjs';
import { API_CONFIG, ApiConfig, buildApiUrl } from '../../../core/api/api.config';
import { mapHttpError } from '../../../core/api/http-error.mapper';
import {
  AlertResourceDto,
  DecideResponseAuthorizationResourceDto,
  ResponseExecutionResourceDto,
} from './alert.dto';
import {
  AlertQueryFilters,
  AlertRecord,
  AlertResponseGateway,
  AuthorizationDecision,
  ConfigureResponsePolicyInput,
  ResponseExecutionQueryFilters,
  ResponseExecutionRecord,
  ResponsePolicyRecord,
  UpdateResponsePolicyInput,
} from './alert.gateway';
import {
  mapAlertResourceDto,
  mapResponseExecutionResourceDto,
} from './alert.mapper';

@Injectable()
export class HttpAlertGateway implements AlertResponseGateway {
  private readonly alertsPath = '/api/v1/alerts';

  constructor(
    private readonly http: HttpClient,
    @Inject(API_CONFIG) private readonly apiConfig: ApiConfig,
  ) {}

  getAlerts(filters: AlertQueryFilters): Observable<AlertRecord[]> {
    let params = new HttpParams();
    if (filters.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters.zoneId) params = params.set('zoneId', filters.zoneId);
    if (filters.riskTypeCode) params = params.set('riskTypeCode', filters.riskTypeCode);
    if (filters.from) params = params.set('from', filters.from.toISOString());
    if (filters.to) params = params.set('to', filters.to.toISOString());

    return this.http
      .get<AlertResourceDto[]>(buildApiUrl(this.apiConfig, this.alertsPath), { params })
      .pipe(
        map((items) => items.map(mapAlertResourceDto)),
        catchError((error) => throwError(() => mapHttpError(error))),
      );
  }

  getAlertById(alertId: string): Observable<AlertRecord | undefined> {
    return this.http
      .get<AlertResourceDto>(buildApiUrl(this.apiConfig, `${this.alertsPath}/${alertId}`))
      .pipe(
        map(mapAlertResourceDto),
        catchError((error) => {
          const mapped = mapHttpError(error);
          return mapped.status === 404 ? of(undefined) : throwError(() => mapped);
        }),
      );
  }

  getResponseExecutions(filters: ResponseExecutionQueryFilters): Observable<ResponseExecutionRecord[]> {
    if (filters.alertId) {
      return this.getAlertExecutions(filters.alertId).pipe(
        map((items) => items.filter((item) =>
          (!filters.status || item.status === filters.status) &&
          (!filters.from || item.requestedAt >= filters.from) &&
          (!filters.to || item.requestedAt <= filters.to),
        )),
      );
    }
    return this.getAlerts({}).pipe(
      switchMap((alerts) => {
        const relevant = filters.riskDetectionId
          ? alerts.filter((alert) => alert.context.riskDetectionId === filters.riskDetectionId)
          : alerts;
        if (!relevant.length) return of([]);
        return forkJoin(relevant.map((alert) => this.getAlertExecutions(alert.alertId))).pipe(
          map((groups) => groups.flat()),
        );
      }),
      map((items) =>
        items.filter((item) =>
          (!filters.status || item.status === filters.status) &&
          (!filters.from || item.requestedAt >= filters.from) &&
          (!filters.to || item.requestedAt <= filters.to),
        ),
      ),
    );
  }

  getResponseExecutionById(id: string): Observable<ResponseExecutionRecord | undefined> {
    return this.getResponseExecutions({}).pipe(map((items) => items.find((item) => item.responseExecutionId === id)));
  }

  decideResponseAuthorization(
    responseExecutionId: string,
    decision: AuthorizationDecision,
  ): Observable<ResponseExecutionRecord> {
    return this.getResponseExecutionById(responseExecutionId).pipe(
      switchMap((execution) => {
        if (!execution?.alertId) {
          return throwError(() => ({
            status: 404,
            code: 'NOT_FOUND',
            message: 'Response execution not found.',
            fieldErrors: [],
          }));
        }
        const body: DecideResponseAuthorizationResourceDto = { decision };
        return this.http.put<ResponseExecutionResourceDto>(
          buildApiUrl(
            this.apiConfig,
            `${this.alertsPath}/${execution.alertId}/response-executions/${responseExecutionId}/authorization`,
          ),
          body,
        );
      }),
      map(mapResponseExecutionResourceDto),
      catchError((error) => throwError(() => mapHttpError(error))),
    );
  }

  getResponsePolicy(_policyId: string): Observable<ResponsePolicyRecord | undefined> {
    return this.unsupported('Response policies are not exposed by the backend.');
  }

  configureResponsePolicy(_input: ConfigureResponsePolicyInput): Observable<ResponsePolicyRecord> {
    return this.unsupported('Response policy configuration is not exposed by the backend.');
  }

  updateResponsePolicy(
    _policyId: string,
    _input: UpdateResponsePolicyInput,
  ): Observable<ResponsePolicyRecord> {
    return this.unsupported('Response policy updates are not exposed by the backend.');
  }

  changeResponsePolicyStatus(_policyId: string, _active: boolean): Observable<ResponsePolicyRecord> {
    return this.unsupported('Response policy status changes are not exposed by the backend.');
  }

  private getAlertExecutions(alertId: string): Observable<ResponseExecutionRecord[]> {
    return this.http
      .get<ResponseExecutionResourceDto[]>(
        buildApiUrl(this.apiConfig, `${this.alertsPath}/${alertId}/response-executions`),
      )
      .pipe(
        map((items) => items.map(mapResponseExecutionResourceDto)),
        catchError((error) => throwError(() => mapHttpError(error))),
      );
  }

  private unsupported<T>(message: string): Observable<T> {
    return throwError(() => ({
      status: 501,
      code: 'UNSUPPORTED_OPERATION',
      message,
      fieldErrors: [],
    }));
  }
}
