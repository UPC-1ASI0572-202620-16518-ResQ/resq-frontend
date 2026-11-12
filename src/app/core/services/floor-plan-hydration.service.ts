import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiError, isApiError } from '../api/api-error';
import { BuildingStoreService } from './building-store.service';
import { FloorPlanLocalStorageService } from './floor-plan-local-storage.service';
import { FloorPlanRemoteService } from './floor-plan-remote.service';

export type FloorPlanHydrationSource = 'REMOTE' | 'LOCAL_404' | 'LOCAL_NETWORK' | 'EMPTY';
export interface FloorPlanHydrationResult {
  source: FloorPlanHydrationSource;
  restored: boolean;
  error?: ApiError;
}

@Injectable({ providedIn: 'root' })
export class FloorPlanHydrationService {
  constructor(
    private readonly remote: FloorPlanRemoteService,
    private readonly local: FloorPlanLocalStorageService,
  ) {}

  hydrate(store: BuildingStoreService, buildingId: string, floorId: string): Observable<FloorPlanHydrationResult> {
    const floor = store.getFloor(buildingId, floorId);
    if (!floor) return of({ source: 'EMPTY', restored: false });
    return this.remote.load(buildingId, floor.name).pipe(
      map(state => {
        if (state) {
          this.local.saveState(state);
          return {
            source: 'REMOTE' as const,
            restored: this.local.restoreStateToStore(store, buildingId, floorId, state),
          };
        }
        return this.restoreFallback(store, buildingId, floorId, floor.name, 'LOCAL_404');
      }),
      catchError(error => {
        const mapped = isApiError(error) ? error : undefined;
        // A network outage may use the browser cache. A server error is surfaced and never
        // replaces current state with a possibly stale local copy.
        if (mapped?.status === 0) {
          return of(this.restoreFallback(store, buildingId, floorId, floor.name, 'LOCAL_NETWORK', mapped));
        }
        return of({ source: 'EMPTY' as const, restored: false, error: mapped });
      }),
    );
  }

  private restoreFallback(
    store: BuildingStoreService,
    buildingId: string,
    floorId: string,
    floorLabel: string,
    source: 'LOCAL_404' | 'LOCAL_NETWORK',
    error?: ApiError,
  ): FloorPlanHydrationResult {
    const state = this.local.load(buildingId, floorLabel);
    return {
      source: state ? source : 'EMPTY',
      restored: state ? this.local.restoreStateToStore(store, buildingId, floorId, state) : false,
      error,
    };
  }
}
