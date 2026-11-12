import { Injectable } from '@angular/core';
import {
  FloorPlanElement,
  FloorPlanPoint,
  FloorPlanPosition,
  Space,
} from '../models/resq.models';
import { BuildingStoreService } from './building-store.service';

const STORAGE_PREFIX = 'resq.floor-plan.v1';
const MAX_SERIALIZED_BYTES = 4 * 1024 * 1024;

interface StoredFloorPlan {
  version: 1;
  buildingId: string;
  floorLabel: string;
  updatedAt: string;
  image?: string;
  elements: FloorPlanElement[];
  spaces: Array<{ spaceId: string; polygon: FloorPlanPoint[] }>;
  devices: Array<{ deviceId: string; spaceId: string; position: FloorPlanPosition }>;
}

export interface FloorPlanSaveResult {
  ok: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class FloorPlanLocalStorageService {
  save(
    buildingId: string,
    floorLabel: string,
    image: string | undefined,
    elements: FloorPlanElement[],
    spaces: Space[],
  ): FloorPlanSaveResult {
    const state: StoredFloorPlan = {
      version: 1,
      buildingId,
      floorLabel,
      updatedAt: new Date().toISOString(),
      image,
      elements: structuredClone(elements),
      spaces: spaces.map((space) => ({
        spaceId: space.id,
        polygon: structuredClone(space.polygon),
      })),
      devices: spaces.flatMap((space) =>
        space.devices
          .filter((device) => Boolean(device.floorPlanPosition))
          .map((device) => ({
            deviceId: device.id,
            spaceId: space.id,
            position: { ...device.floorPlanPosition! },
          })),
      ),
    };

    try {
      const serialized = JSON.stringify(state);
      if (new Blob([serialized]).size > MAX_SERIALIZED_BYTES) {
        return {
          ok: false,
          message: 'The local plan is too large. Use a smaller background image (about 2 MB or less).',
        };
      }
      localStorage.setItem(this.key(buildingId, floorLabel), serialized);
      return {
        ok: true,
        message: 'Plan saved in this browser; it is not synchronized with the server.',
      };
    } catch {
      return {
        ok: false,
        message: 'The browser could not store this plan. Check storage permissions or use a smaller image.',
      };
    }
  }

  restoreToStore(
    store: BuildingStoreService,
    buildingId: string,
    floorId: string,
  ): boolean {
    const floor = store.getFloor(buildingId, floorId);
    if (!floor) return false;
    const state = this.load(buildingId, floor.name);
    if (!state) return false;

    const spacesById = new Map(floor.spaces.map((space) => [space.id, space]));
    const polygonBySpace = new Map(state.spaces.map((space) => [space.spaceId, space.polygon]));
    const spaces = floor.spaces.map((space) => ({
      ...space,
      polygon: structuredClone(polygonBySpace.get(space.id) ?? space.polygon),
    }));
    const elements = state.elements.filter(
      (element) => element.type !== 'Space' || (!!element.spaceId && spacesById.has(element.spaceId)),
    );
    store.updateFloor(buildingId, {
      ...floor,
      spaces,
      planImageUrl: state.image,
      planElements: structuredClone(elements),
      planConfigured: Boolean(elements.length || state.image || spaces.some((space) => space.polygon.length >= 3)),
    });

    const devices = new Map(store.devices().map((device) => [device.id, device]));
    for (const item of state.devices) {
      const device = devices.get(item.deviceId);
      // Visual placement never changes the real zone assignment.
      if (!device || device.spaceId !== item.spaceId || !spacesById.has(item.spaceId)) continue;
      if (device.administrativeStatus !== 'ACTIVE') continue;
      store.updateDevicePosition(buildingId, floorId, item.spaceId, item.deviceId, item.position);
    }
    return true;
  }

  private load(buildingId: string, floorLabel: string): StoredFloorPlan | undefined {
    try {
      const raw = localStorage.getItem(this.key(buildingId, floorLabel));
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as Partial<StoredFloorPlan>;
      if (
        parsed.version !== 1 ||
        parsed.buildingId !== buildingId ||
        parsed.floorLabel !== floorLabel ||
        !Array.isArray(parsed.elements) ||
        !Array.isArray(parsed.spaces) ||
        !Array.isArray(parsed.devices)
      ) return undefined;
      return parsed as StoredFloorPlan;
    } catch {
      return undefined;
    }
  }

  private key(buildingId: string, floorLabel: string): string {
    return `${STORAGE_PREFIX}:${encodeURIComponent(buildingId)}:${encodeURIComponent(floorLabel)}`;
  }
}
