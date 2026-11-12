import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { API_CONFIG, ApiConfig, buildApiUrl } from '../api/api.config';
import { mapHttpError } from '../api/http-error.mapper';
import { StoredFloorPlan } from './floor-plan-local-storage.service';

interface FloorPlanRemoteResource {
  layout: StoredFloorPlan;
}

@Injectable({ providedIn: 'root' })
export class FloorPlanRemoteService {
  private readonly etags = new Map<string, string>();
  constructor(
    private readonly http: HttpClient,
    @Inject(API_CONFIG) private readonly apiConfig: ApiConfig,
  ) {}

  load(buildingId: string, floorLabel: string): Observable<StoredFloorPlan | undefined> {
    const key = this.key(buildingId, floorLabel);
    return this.http.get<FloorPlanRemoteResource>(this.url(buildingId, floorLabel), { observe: 'response' }).pipe(
      map((response) => {
        const etag = response.headers.get('ETag');
        if (etag) this.etags.set(key, etag);
        if (!response.body) throw new Error('The Floor Plans API returned an empty response.');
        return response.body.layout;
      }),
      catchError((error) => {
        const mapped = mapHttpError(error);
        if (mapped.status === 404) {
          this.etags.delete(key);
          return of(undefined);
        }
        return throwError(() => mapped);
      }),
    );
  }

  save(state: StoredFloorPlan): Observable<StoredFloorPlan> {
    const key = this.key(state.buildingId, state.floorLabel);
    const etag = this.etags.get(key);
    const headers = etag ? new HttpHeaders({ 'If-Match': etag }) : undefined;
    return this.http.put<FloorPlanRemoteResource>(
      this.url(state.buildingId, state.floorLabel),
      { layout: state },
      { headers, observe: 'response' },
    ).pipe(
      map((response) => {
        const nextEtag = response.headers.get('ETag');
        if (nextEtag) this.etags.set(key, nextEtag);
        if (!response.body) throw new Error('The Floor Plans API returned an empty response.');
        return response.body.layout;
      }),
      catchError((error) => throwError(() => mapHttpError(error))),
    );
  }

  private url(buildingId: string, floorLabel: string): string {
    return buildApiUrl(
      this.apiConfig,
      `/api/v1/buildings/${buildingId}/floors/${encodeURIComponent(floorLabel)}/plan`,
    );
  }

  private key(buildingId: string, floorLabel: string): string {
    return `${buildingId}:${floorLabel}`;
  }
}
