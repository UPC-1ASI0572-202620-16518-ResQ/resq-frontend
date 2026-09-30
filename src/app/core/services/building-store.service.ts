import { Injectable, computed, signal } from '@angular/core';
import { BUILDINGS, DEVICES } from '../mock-data/resq.mock';
import {
  Building,
  Device,
  Floor,
  FloorPlanElement,
  FloorPlanPosition,
  Space,
} from '../models/resq.models';

export interface FloorPlanUpdate {
  planImageUrl?: string;
  planElements: FloorPlanElement[];
  planConfigured: boolean;
}

/**
 * Session-only source of truth for the building hierarchy.
 * A future HTTP implementation can replace these mutations without changing pages.
 */
@Injectable({ providedIn: 'root' })
export class BuildingStoreService {
  private readonly buildingsState = signal<Building[]>(structuredClone(BUILDINGS));
  private readonly devicesState = signal<Device[]>(structuredClone(DEVICES));

  readonly buildings = this.buildingsState.asReadonly();
  readonly devices = this.devicesState.asReadonly();
  readonly floors = computed(() => this.buildingsState().flatMap(building => building.floors));
  readonly spaces = computed(() => this.floors().flatMap(floor => floor.spaces));

  getBuilding(id: string): Building | undefined {
    return this.buildingsState().find(building => building.id === id);
  }

  getFloor(buildingId: string, floorId: string): Floor | undefined {
    return this.getBuilding(buildingId)?.floors.find(floor => floor.id === floorId);
  }

  getFloorById(floorId: string): Floor | undefined {
    return this.floors().find(floor => floor.id === floorId);
  }

  getSpace(buildingId: string, floorId: string, spaceId: string): Space | undefined {
    return this.getFloor(buildingId, floorId)?.spaces.find(space => space.id === spaceId);
  }

  createBuilding(building: Building): void {
    if (this.getBuilding(building.id)) {
      throw new Error(`Building with id "${building.id}" already exists.`);
    }
    this.buildingsState.update(buildings => [...buildings, structuredClone(building)]);
  }

  updateBuilding(building: Building): void {
    this.buildingsState.update(buildings => buildings.map(current =>
      current.id === building.id ? structuredClone(building) : current
    ));
    const validSpaceIds = new Set(this.spaces().map(space => space.id));
    this.devicesState.update(devices => devices.filter(device => validSpaceIds.has(device.spaceId)));
  }

  deleteBuilding(id: string): void {
    const removedSpaceIds = new Set(
      this.getBuilding(id)?.floors.flatMap(floor => floor.spaces.map(space => space.id)) ?? []
    );
    this.buildingsState.update(buildings => buildings.filter(building => building.id !== id));
    this.devicesState.update(devices => devices.filter(device => !removedSpaceIds.has(device.spaceId)));
  }

  addFloor(buildingId: string, floor: Floor): void {
    this.updateFloors(buildingId, floors => [...floors, structuredClone(floor)]);
  }

  updateFloor(buildingId: string, floor: Floor): void {
    this.updateFloors(buildingId, floors => floors.map(current =>
      current.id === floor.id ? structuredClone(floor) : current
    ));
  }

  deleteFloor(buildingId: string, floorId: string): void {
    const removedSpaceIds = new Set(
      this.getFloor(buildingId, floorId)?.spaces.map(space => space.id) ?? []
    );
    this.updateFloors(buildingId, floors => floors.filter(floor => floor.id !== floorId));
    this.devicesState.update(devices => devices.filter(device => !removedSpaceIds.has(device.spaceId)));
  }

  addSpace(buildingId: string, floorId: string, space: Space): void {
    this.updateSpaces(buildingId, floorId, spaces => [...spaces, structuredClone(space)]);
  }

  updateSpace(buildingId: string, floorId: string, space: Space): void {
    this.updateSpaces(buildingId, floorId, spaces => spaces.map(current =>
      current.id === space.id ? structuredClone(space) : current
    ));
  }

  deleteSpace(buildingId: string, floorId: string, spaceId: string): void {
    this.updateSpaces(buildingId, floorId, spaces => spaces.filter(space => space.id !== spaceId));
    this.devicesState.update(devices => devices.filter(device => device.spaceId !== spaceId));
  }

  updateFloorPlan(buildingId: string, floorId: string, update: FloorPlanUpdate): void {
    const floor = this.getFloor(buildingId, floorId);
    if (!floor) return;
    this.updateFloor(buildingId, {
      ...floor,
      ...update,
      planElements: structuredClone(update.planElements),
    });
  }

  updateDevicePosition(
    buildingId: string,
    floorId: string,
    spaceId: string,
    deviceId: string,
    position?: FloorPlanPosition,
  ): void {
    const space = this.getSpace(buildingId, floorId, spaceId);
    if (!space) return;

    const updateDevice = (device: Device): Device =>
      device.id === deviceId ? { ...device, floorPlanPosition: position } : device;

    this.updateSpace(buildingId, floorId, {
      ...space,
      devices: space.devices.map(updateDevice),
    });
    this.devicesState.update(devices => devices.map(updateDevice));
  }

  createDevice(device: Device): void {
    if (this.devicesState().some(item => item.id === device.id)) {
      throw new Error(`Device with id "${device.id}" already exists.`);
    }
    this.devicesState.update(devices => [...devices, structuredClone(device)]);
    this.addDeviceToAssignedSpace(device);
  }

  updateDevice(device: Device): void {
    this.devicesState.update(devices => devices.some(item => item.id === device.id)
      ? devices.map(item => item.id === device.id ? structuredClone(device) : item)
      : [...devices, structuredClone(device)]
    );
    this.removeDeviceFromAllSpaces(device.id);
    this.addDeviceToAssignedSpace(device);
  }

  moveDevice(deviceId: string, spaceId: string, position: FloorPlanPosition): void {
    const device = this.devicesState().find(item => item.id === deviceId);
    if (device) this.updateDevice({ ...device, spaceId, floorPlanPosition: position });
  }

  removeDevicePosition(deviceId: string): void {
    const device = this.devicesState().find(item => item.id === deviceId);
    if (device) this.updateDevice({ ...device, floorPlanPosition: undefined });
  }

  deleteDevice(deviceId: string): void {
    this.devicesState.update(devices => devices.filter(device => device.id !== deviceId));
    this.removeDeviceFromAllSpaces(deviceId);
  }

  syncFloorDevices(buildingId: string, floorId: string, devices: Device[]): void {
    const floor = this.getFloor(buildingId, floorId);
    if (!floor) return;
    const floorSpaceIds = new Set(floor.spaces.map(space => space.id));
    const incomingIds = new Set(devices.map(device => device.id));
    this.devicesState.update(current => [
      ...current.filter(device => !floorSpaceIds.has(device.spaceId) || incomingIds.has(device.id))
        .filter(device => !incomingIds.has(device.id)),
      ...structuredClone(devices),
    ]);
    this.updateSpaces(buildingId, floorId, spaces => spaces.map(space => ({
      ...space,
      devices: structuredClone(devices.filter(device => device.spaceId === space.id)),
    })));
  }

  private removeDeviceFromAllSpaces(deviceId: string): void {
    this.buildingsState.update(buildings => buildings.map(building => ({
      ...building,
      floors: building.floors.map(floor => ({
        ...floor,
        spaces: floor.spaces.map(space => ({ ...space, devices: space.devices.filter(device => device.id !== deviceId) })),
      })),
    })));
  }

  private addDeviceToAssignedSpace(device: Device): void {
    this.buildingsState.update(buildings => buildings.map(building => ({
      ...building,
      floors: building.floors.map(floor => ({
        ...floor,
        spaces: floor.spaces.map(space => space.id === device.spaceId
          ? { ...space, devices: [...space.devices, structuredClone(device)] }
          : space
        ),
      })),
    })));
  }

  private updateFloors(buildingId: string, update: (floors: Floor[]) => Floor[]): void {
    this.buildingsState.update(buildings => buildings.map(building =>
      building.id === buildingId ? { ...building, floors: update(building.floors) } : building
    ));
  }

  private updateSpaces(
    buildingId: string,
    floorId: string,
    update: (spaces: Space[]) => Space[],
  ): void {
    this.updateFloors(buildingId, floors => floors.map(floor =>
      floor.id === floorId ? { ...floor, spaces: update(floor.spaces) } : floor
    ));
  }
}
