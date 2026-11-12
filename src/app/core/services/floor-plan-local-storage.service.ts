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

export interface StoredFloorPlan {
  version: 1;
  buildingId: string;
  floorLabel: string;
  updatedAt: string;
  image?: string;
  elements: FloorPlanElement[];
  spaces: Array<{
    spaceId: string;
    polygon: FloorPlanPoint[];
    type?: Space['type'];
    sensitivity?: Space['sensitivity'];
    thresholds?: Space['thresholds'];
  }>;
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
    const state = this.capture(buildingId, floorLabel, image, elements, spaces);

    return this.saveState(state);
  }

  capture(
    buildingId: string,
    floorLabel: string,
    image: string | undefined,
    elements: FloorPlanElement[],
    spaces: Space[],
  ): StoredFloorPlan {
    return {
      version: 1,
      buildingId,
      floorLabel,
      updatedAt: new Date().toISOString(),
      image,
      elements: structuredClone(elements),
      spaces: spaces.map((space) => ({
        spaceId: space.id,
        polygon: structuredClone(space.polygon),
        type: space.type,
        sensitivity: space.sensitivity,
        thresholds: structuredClone(space.thresholds),
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
  }

  saveState(state: StoredFloorPlan): FloorPlanSaveResult {
    try {
      const serialized = JSON.stringify(state);
      if (new Blob([serialized]).size > MAX_SERIALIZED_BYTES) {
        return {
          ok: false,
          message: 'The local plan is too large. Use a smaller background image (about 2 MB or less).',
        };
      }
      localStorage.setItem(this.key(state.buildingId, state.floorLabel), serialized);
      return {
        ok: true,
        message: 'Plan cached in this browser.',
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

    return this.restoreStateToStore(store, buildingId, floorId, state);
  }

  restoreStateToStore(
    store: BuildingStoreService,
    buildingId: string,
    floorId: string,
    state: StoredFloorPlan,
  ): boolean {
    const floor = store.getFloor(buildingId, floorId);
    if (!floor || state.buildingId !== buildingId || state.floorLabel !== floor.name) return false;

    const spacesById = new Map(floor.spaces.map((space) => [space.id, space]));
    const layoutBySpace = new Map(state.spaces.map((space) => [space.spaceId, space]));
    const spaces = floor.spaces.map((space) => ({
      ...space,
      polygon: structuredClone(layoutBySpace.get(space.id)?.polygon ?? space.polygon),
      type: layoutBySpace.get(space.id)?.type ?? space.type,
      sensitivity: layoutBySpace.get(space.id)?.sensitivity ?? space.sensitivity,
      thresholds: structuredClone(layoutBySpace.get(space.id)?.thresholds ?? space.thresholds),
      configurationPersisted: Boolean(
        layoutBySpace.get(space.id)?.type && layoutBySpace.get(space.id)?.sensitivity),
    }));
    const elements = state.elements
      .filter((element) =>
        Boolean(element.id) &&
        Number.isFinite(element.x) && Number.isFinite(element.y) &&
        Number.isFinite(element.width) && Number.isFinite(element.height) &&
        element.width >= 0 && element.height >= 0)
      .map((element) => element.type === 'Space' && (!element.spaceId || !spacesById.has(element.spaceId))
        ? { ...element, spaceId: undefined, label: element.label || 'Unmonitored area' }
        : element);
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

  load(buildingId: string, floorLabel: string): StoredFloorPlan | undefined {
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
