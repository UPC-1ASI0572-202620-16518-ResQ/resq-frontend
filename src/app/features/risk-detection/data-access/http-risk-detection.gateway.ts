import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { API_CONFIG, ApiConfig, buildApiUrl } from '../../../core/api/api.config';
import { mapHttpError } from '../../../core/api/http-error.mapper';
import {
  ChangeDetectionRuleStatusResourceDto,
  ConfigureDetectionRuleResourceDto,
  DetectionRuleResourceDto,
  RiskDetectionResourceDto,
} from './risk-detection.dto';
import {
  ConfigureDetectionRuleInput,
  DetectionRuleRecord,
  RiskDetectionGateway,
  RiskDetectionRecord,
} from './risk-detection.gateway';
import {
  mapDetectionRuleResourceDto,
  mapRiskDetectionResourceDto,
} from './risk-detection.mapper';

@Injectable()
export class HttpRiskDetectionGateway implements RiskDetectionGateway {
  private readonly detectionsPath = '/api/v1/risk-detections';
  private readonly rulesPath = '/api/v1/risk-detection/rules';

  constructor(
    private readonly http: HttpClient,
    @Inject(API_CONFIG) private readonly apiConfig: ApiConfig,
  ) {}

  getDetectionRules(): Observable<DetectionRuleRecord[]> {
    return this.http
      .get<DetectionRuleResourceDto[]>(buildApiUrl(this.apiConfig, this.rulesPath))
      .pipe(
        map((items) => items.map(mapDetectionRuleResourceDto)),
        catchError((error) => throwError(() => mapHttpError(error))),
      );
  }

  getDetectionRuleById(ruleId: string): Observable<DetectionRuleRecord | undefined> {
    return this.http
      .get<DetectionRuleResourceDto>(buildApiUrl(this.apiConfig, `${this.rulesPath}/${ruleId}`))
      .pipe(
        map(mapDetectionRuleResourceDto),
        catchError((error) => {
          const mapped = mapHttpError(error);
          return mapped.status === 404 ? of(undefined) : throwError(() => mapped);
        }),
      );
  }

  getRiskDetections(
    filters: { buildingId?: string; zoneId?: string; riskTypeCode?: string } = {},
  ): Observable<RiskDetectionRecord[]> {
    let params = new HttpParams();
    if (filters.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters.zoneId) params = params.set('zoneId', filters.zoneId);
    if (filters.riskTypeCode) params = params.set('riskTypeCode', filters.riskTypeCode);
    return this.http
      .get<RiskDetectionResourceDto[]>(buildApiUrl(this.apiConfig, this.detectionsPath), { params })
      .pipe(
        map((items) => items.map(mapRiskDetectionResourceDto)),
        catchError((error) => throwError(() => mapHttpError(error))),
      );
  }

  getRiskDetectionById(id: string): Observable<RiskDetectionRecord | undefined> {
    return this.getOptional(`${this.detectionsPath}/${id}`);
  }

  getRiskDetectionEvidence(id: string): Observable<RiskDetectionRecord | undefined> {
    return this.getOptional(`${this.detectionsPath}/${id}/evidence`);
  }

  configureDetectionRule(input: ConfigureDetectionRuleInput): Observable<DetectionRuleRecord> {
    const body: ConfigureDetectionRuleResourceDto = { ...input };
    return this.http
      .post<DetectionRuleResourceDto>(buildApiUrl(this.apiConfig, this.rulesPath), body)
      .pipe(
        map(mapDetectionRuleResourceDto),
        catchError((error) => throwError(() => mapHttpError(error))),
      );
  }

  changeDetectionRuleStatus(ruleId: string, active: boolean): Observable<DetectionRuleRecord> {
    const body: ChangeDetectionRuleStatusResourceDto = { active };
    return this.http
      .patch<DetectionRuleResourceDto>(
        buildApiUrl(this.apiConfig, `${this.rulesPath}/${ruleId}/status`),
        body,
      )
      .pipe(
        map(mapDetectionRuleResourceDto),
        catchError((error) => throwError(() => mapHttpError(error))),
      );
  }

  private getOptional(path: string): Observable<RiskDetectionRecord | undefined> {
    return this.http
      .get<RiskDetectionResourceDto>(buildApiUrl(this.apiConfig, path))
      .pipe(
        map(mapRiskDetectionResourceDto),
        catchError((error) => {
          const mapped = mapHttpError(error);
          return mapped.status === 404 ? of(undefined) : throwError(() => mapped);
        }),
      );
  }
}
