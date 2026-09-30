import { Inject, Injectable } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { SearchResult } from '../../core/models/resq.models';
import { BUILDING_GATEWAY, BuildingGateway } from '../buildings/data-access/building.gateway';
import { DEVICE_GATEWAY, DeviceGateway } from '../devices/data-access/device.gateway';

@Injectable({ providedIn: 'root' })
export class GlobalSearchFacade {
  constructor(
    @Inject(BUILDING_GATEWAY) private readonly buildings: BuildingGateway,
    @Inject(DEVICE_GATEWAY) private readonly devices: DeviceGateway,
  ) {}

  search(query: string): Observable<SearchResult[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return of([]);

    return forkJoin({
      buildings: this.buildings.getBuildings({}, { page: 0, size: 100 }),
      devices: this.devices.getDevices({}, { page: 0, size: 100 }),
    }).pipe(
      map(({ buildings, devices }) => {
        const buildingResults: SearchResult[] = buildings.items
          .filter((building) =>
            `${building.name} ${building.buildingCode} ${building.address.streetAddress}`
              .toLowerCase()
              .includes(normalized),
          )
          .map((building) => ({
            id: building.id,
            type: 'Building',
            title: building.name,
            subtitle: building.address.streetAddress || building.buildingCode,
            route: `/buildings/${building.id}`,
          }));

        const zoneResults: SearchResult[] = buildings.items.flatMap((building) =>
          building.zones
            .filter((zone) =>
              `${zone.name} ${zone.zoneCode} ${zone.floorLabel ?? ''} ${building.name}`
                .toLowerCase()
                .includes(normalized),
            )
            .map((zone) => ({
              id: zone.id,
              type: 'Space' as const,
              title: zone.name,
              subtitle: `${building.name}${zone.floorLabel ? ` · ${zone.floorLabel}` : ''}`,
              route: `/spaces/${zone.id}`,
            })),
        );

        const deviceResults: SearchResult[] = devices.items
          .filter((device) =>
            `${device.name} ${device.deviceCode} ${device.specifications.model ?? ''} ${device.specifications.serialNumber ?? ''}`
              .toLowerCase()
              .includes(normalized),
          )
          .map((device) => ({
            id: device.id,
            type: 'Device',
            title: device.name,
            subtitle: device.deviceCode,
            route: `/devices/${device.id}`,
          }));

        return [...buildingResults, ...zoneResults, ...deviceResults].slice(0, 12);
      }),
    );
  }
}
