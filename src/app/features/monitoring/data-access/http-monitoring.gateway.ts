import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, catchError, defer, map, of, throwError } from 'rxjs';
import { API_CONFIG, ApiConfig, buildApiUrl } from '../../../core/api/api.config';
import { mapHttpError } from '../../../core/api/http-error.mapper';
import {
  BuildingMonitoringStatusResourceDto,
  DeviceMonitoringStateResourceDto,
  MonitoringMeasurementResourceDto,
  ZoneMonitoringStateResourceDto,
} from './monitoring.dto';
import {
  BuildingMonitoringStatus,
  CurrentMeasurementsQuery,
  DeviceMonitoringState,
  MeasurementTimeRange,
  MonitoringGateway,
  MonitoringMeasurement,
  ZoneMonitoringState,
  ZoneMonitoringProfile,
  ZoneMonitoringRuleInput,
} from './monitoring.gateway';
import {
  mapZoneMonitoringProfileRequest,
  mapZoneMonitoringProfileResponse,
} from './monitoring-profile.mapper';
import {
  mapBuildingMonitoringStatus,
  mapDeviceMonitoringState,
  mapMonitoringMeasurement,
  mapZoneMonitoringState,
} from './monitoring.mapper';

@Injectable()
export class HttpMonitoringGateway implements MonitoringGateway {
  private readonly path = '/api/v1/monitoring';

  constructor(
    private readonly http: HttpClient,
    @Inject(API_CONFIG) private readonly apiConfig: ApiConfig,
  ) {}

  getBuildingStatus(buildingId: string): Observable<BuildingMonitoringStatus | undefined> {
    return this.optionalGet<BuildingMonitoringStatusResourceDto, BuildingMonitoringStatus>(
      `${this.path}/buildings/${buildingId}/status`,
      mapBuildingMonitoringStatus,
    );
  }

  getZoneStatus(zoneId: string): Observable<ZoneMonitoringState | undefined> {
    return this.optionalGet<ZoneMonitoringStateResourceDto, ZoneMonitoringState>(
      `${this.path}/zones/${zoneId}/status`,
      mapZoneMonitoringState,
    );
  }

  getDeviceStatus(deviceId: string): Observable<DeviceMonitoringState | undefined> {
    return this.optionalGet<DeviceMonitoringStateResourceDto, DeviceMonitoringState>(
      `${this.path}/devices/${deviceId}/status`,
      mapDeviceMonitoringState,
    );
  }

  getCurrentMeasurements(query: CurrentMeasurementsQuery): Observable<MonitoringMeasurement[]> {
    if (!query.deviceId && !query.zoneId) return of([]);
    const resource = query.deviceId
      ? `devices/${query.deviceId}`
      : `zones/${query.zoneId}`;
    return this.http
      .get<MonitoringMeasurementResourceDto[]>(
        buildApiUrl(this.apiConfig, `${this.path}/${resource}/measurements/current`),
      )
      .pipe(
        map((items) => items.map(mapMonitoringMeasurement)),
        catchError((error) => {
          const mapped = mapHttpError(error);
          return mapped.status === 404 ? of([]) : throwError(() => mapped);
        }),
      );
  }

  getDeviceMeasurements(
    deviceId: string,
    range?: MeasurementTimeRange,
  ): Observable<MonitoringMeasurement[]> {
    let url = `${this.path}/devices/${deviceId}/measurements/history`;
    const query = range
      ? `?from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`
      : '';
    return this.http.get<MonitoringMeasurementResourceDto[]>(buildApiUrl(this.apiConfig, url + query)).pipe(
      map((items) => items.map(mapMonitoringMeasurement)),
      catchError((error) => throwError(() => mapHttpError(error))),
    );
  }

  getZoneProfile(zoneId: string): Observable<ZoneMonitoringProfile> {
    return this.http.get<unknown>(
      buildApiUrl(this.apiConfig, `${this.path}/zones/${zoneId}/profile`),
    ).pipe(
      map(mapZoneMonitoringProfileResponse),
      catchError((error) => throwError(() => mapHttpError(error))),
    );
  }

  saveZoneProfile(zoneId: string, rules: ZoneMonitoringRuleInput[]): Observable<ZoneMonitoringProfile> {
    return defer(() => this.http.put<unknown>(
        buildApiUrl(this.apiConfig, `${this.path}/zones/${zoneId}/profile`),
        mapZoneMonitoringProfileRequest(rules),
      )).pipe(
      map(mapZoneMonitoringProfileResponse),
      catchError((error) => throwError(() => mapHttpError(error))),
    );
  }

  private optionalGet<TDto, TRecord>(
    path: string,
    mapper: (dto: TDto) => TRecord,
  ): Observable<TRecord | undefined> {
    return this.http.get<TDto>(buildApiUrl(this.apiConfig, path)).pipe(
      map(mapper),
      catchError((error) => {
        const mapped = mapHttpError(error);
        return mapped.status === 404 ? of(undefined) : throwError(() => mapped);
      }),
    );
  }
}
