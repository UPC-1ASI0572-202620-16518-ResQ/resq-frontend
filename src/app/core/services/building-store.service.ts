import { Injectable, computed, signal } from '@angular/core';
import { BUILDINGS, DEVICES } from '../mock-data/resq.mock';
import { INITIAL_RESPONSE_RULES } from '../mock-data/response-rules.mock';
import {
  Building,
  Device,
  Floor,
  FloorPlanElement,
  FloorPlanPosition,
  Space,
  ResponseRule,
  ResponseEvent,
  riskRank,
  RiskStatus,
} from '../models/resq.models';
import { capabilityCategory } from '../models/device-domain';
import { evaluateZone } from '../models/response-evaluation';
import { evaluateMeasurement } from './risk-evaluation.service';

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
  private readonly devicesState = signal<Device[]>(structuredClone(DEVICES));
  private readonly buildingsState = signal<Building[]>(structuredClone(BUILDINGS));

  private readonly rulesState = signal<ResponseRule[]>(structuredClone(INITIAL_RESPONSE_RULES));
  private readonly eventsState = signal<ResponseEvent[]>([]);
  readonly rules = this.rulesState.asReadonly();
  readonly events = this.eventsState.asReadonly();
  readonly buildings = computed(() =>
    this.attachDevicesToSpaces(this.buildingsState(), this.devicesState()),
  );
  readonly devices = this.devicesState.asReadonly();
  readonly floors = computed(() => this.buildings().flatMap((building) => building.floors));
  readonly spaces = computed(() => this.floors().flatMap((floor) => floor.spaces));

  constructor() {
    // Initial risk/output projections use exactly the same evaluator as telemetry.
    this.updateDevices(
      this.spaces().flatMap(
        (space) => evaluateZone(space, space.devices, this.rules(), evaluateMeasurement).devices,
      ),
    );
  }

  private attachDevicesToSpaces(buildings: Building[], devices: Device[]): Building[] {
    const highest = (statuses: RiskStatus[]) =>
      statuses.reduce(
        (result, status) => (riskRank[status] > riskRank[result] ? status : result),
        'Normal' as RiskStatus,
      );
    return buildings.map((building) => {
      const floors = building.floors.map((floor) => {
        const spaces = floor.spaces.map((space) => {
          const assigned = devices.filter((device) => device.assignment.spaceId === space.id);
          const sensors = assigned.filter((device) =>
            device.capabilities.some((cap) => capabilityCategory(cap) === 'SENSOR'),
          );
          const statuses: RiskStatus[] = sensors.map((device) =>
            device.connectivityStatus === 'OFFLINE'
              ? 'Offline'
              : device.healthStatus === 'CRITICAL'
                ? 'Critical'
                : device.healthStatus === 'WARNING'
                  ? 'Warning'
                  : 'Normal',
          );
          return {
            ...space,
            devices: assigned,
            status:
              statuses.length && statuses.every((status) => status === 'Offline')
                ? ('Offline' as const)
                : highest(statuses),
          };
        });
        return { ...floor, spaces, status: highest(spaces.map((space) => space.status)) };
      });
      return { ...building, floors, status: highest(floors.map((floor) => floor.status)) };
    });
  }

  getBuilding(id: string): Building | undefined {
    return this.buildings().find((building) => building.id === id);
  }

  getFloor(buildingId: string, floorId: string): Floor | undefined {
    return this.getBuilding(buildingId)?.floors.find((floor) => floor.id === floorId);
  }

  getFloorById(floorId: string): Floor | undefined {
    return this.floors().find((floor) => floor.id === floorId);
  }

  getSpace(buildingId: string, floorId: string, spaceId: string): Space | undefined {
    return this.getFloor(buildingId, floorId)?.spaces.find((space) => space.id === spaceId);
  }

  createBuilding(building: Building): void {
    if (this.getBuilding(building.id)) {
      throw new Error(`Building with id "${building.id}" already exists.`);
    }
    this.buildingsState.update((buildings) => [...buildings, structuredClone(building)]);
  }

  updateBuilding(building: Building): void {
    this.buildingsState.update((buildings) =>
      buildings.map((current) =>
        current.id === building.id ? structuredClone(building) : current,
      ),
    );
    const validSpaceIds = new Set(this.spaces().map((space) => space.id));
    this.devicesState.update((devices) =>
      devices.filter((device) => validSpaceIds.has(device.spaceId)),
    );
    this.pruneRules();
  }

  deleteBuilding(id: string): void {
    const removedSpaceIds = new Set(
      this.getBuilding(id)?.floors.flatMap((floor) => floor.spaces.map((space) => space.id)) ?? [],
    );
    this.buildingsState.update((buildings) => buildings.filter((building) => building.id !== id));
    this.devicesState.update((devices) =>
      devices.filter((device) => !removedSpaceIds.has(device.spaceId)),
    );
    this.pruneRules();
  }

  addFloor(buildingId: string, floor: Floor): void {
    this.updateFloors(buildingId, (floors) => [...floors, structuredClone(floor)]);
  }

  updateFloor(buildingId: string, floor: Floor): void {
    this.updateFloors(buildingId, (floors) =>
      floors.map((current) => (current.id === floor.id ? structuredClone(floor) : current)),
    );
  }

  deleteFloor(buildingId: string, floorId: string): void {
    const removedSpaceIds = new Set(
      this.getFloor(buildingId, floorId)?.spaces.map((space) => space.id) ?? [],
    );
    this.updateFloors(buildingId, (floors) => floors.filter((floor) => floor.id !== floorId));
    this.devicesState.update((devices) =>
      devices.filter((device) => !removedSpaceIds.has(device.spaceId)),
    );
    this.pruneRules();
  }

  addSpace(buildingId: string, floorId: string, space: Space): void {
    this.updateSpaces(buildingId, floorId, (spaces) => [...spaces, structuredClone(space)]);
  }

  updateSpace(buildingId: string, floorId: string, space: Space): void {
    this.updateSpaces(buildingId, floorId, (spaces) =>
      spaces.map((current) => (current.id === space.id ? structuredClone(space) : current)),
    );
  }

  deleteSpace(buildingId: string, floorId: string, spaceId: string): void {
    this.updateSpaces(buildingId, floorId, (spaces) =>
      spaces.filter((space) => space.id !== spaceId),
    );
    this.devicesState.update((devices) => devices.filter((device) => device.spaceId !== spaceId));
    this.pruneRules();
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
    this.devicesState.update((devices) => devices.map(updateDevice));
  }

  createDevice(device: Device): void {
    if (this.devicesState().some((item) => item.id === device.id)) {
      throw new Error(`Device with id "${device.id}" already exists.`);
    }
    this.devicesState.update((devices) => [...devices, structuredClone(device)]);
  }

  updateDevice(device: Device): void {
    this.devicesState.update((devices) =>
      devices.some((item) => item.id === device.id)
        ? devices.map((item) => (item.id === device.id ? structuredClone(device) : item))
        : [...devices, structuredClone(device)],
    );
    this.pruneRules();
  }

  moveDevice(deviceId: string, spaceId: string, position: FloorPlanPosition): void {
    const device = this.devicesState().find((item) => item.id === deviceId);
    const space = this.spaces().find((item) => item.id === spaceId);
    if (device && space)
      this.updateDevice({
        ...device,
        spaceId,
        assignment: {
          ...device.assignment,
          buildingId: space.buildingId,
          floorId: space.floorId,
          zoneId: space.id,
          spaceId: space.id,
        },
        floorPlanPosition: position,
        updatedAt: new Date(),
        version: device.version + 1,
      });
  }

  removeDevicePosition(deviceId: string): void {
    const device = this.devicesState().find((item) => item.id === deviceId);
    if (device) this.updateDevice({ ...device, floorPlanPosition: undefined });
  }

  deleteDevice(deviceId: string): void {
    this.devicesState.update((devices) => devices.filter((device) => device.id !== deviceId));
    this.pruneRules();
  }

  setRules(rules: ResponseRule[]): void {
    this.rulesState.set(structuredClone(rules));
  }
  recordEvent(event: ResponseEvent): void {
    this.eventsState.update((events) => [event, ...events].slice(0, 250));
  }
  updateDevices(devices: Device[]): void {
    const updates = new Map(devices.map((device) => [device.id, device]));
    this.devicesState.update((current) =>
      current.map((device) => updates.get(device.id) ?? device),
    );
  }
  private pruneRules(): void {
    const devices = new Map(this.devicesState().map((device) => [device.id, device]));
    const ids = new Set(devices.keys());
    this.rulesState.update((rules) =>
      rules
        .filter((rule) => !rule.sourceDeviceId || ids.has(rule.sourceDeviceId))
        .map((rule) => ({
          ...rule,
          targets: rule.targets?.filter((target) => {
            const device = devices.get(target.deviceId);
            const source = rule.sourceDeviceId ? devices.get(rule.sourceDeviceId) : undefined;
            return (
              device &&
              (!source || source.spaceId === device.spaceId) &&
              device.capabilities.some(
                (cap) =>
                  cap.code === target.capabilityCode && capabilityCategory(cap) === 'ACTUATOR',
              )
            );
          }),
        })),
    );
  }

  syncFloorDevices(buildingId: string, floorId: string, devices: Device[]): void {
    const floor = this.getFloor(buildingId, floorId);
    if (!floor) return;
    const floorSpaceIds = new Set(floor.spaces.map((space) => space.id));
    const incomingIds = new Set(devices.map((device) => device.id));
    this.devicesState.update((current) => [
      ...current
        .filter((device) => !floorSpaceIds.has(device.spaceId) || incomingIds.has(device.id))
        .filter((device) => !incomingIds.has(device.id)),
      ...structuredClone(devices),
    ]);
    this.updateSpaces(buildingId, floorId, (spaces) =>
      spaces.map((space) => ({
        ...space,
        devices: structuredClone(devices.filter((device) => device.spaceId === space.id)),
      })),
    );
    this.pruneRules();
  }

  private updateFloors(buildingId: string, update: (floors: Floor[]) => Floor[]): void {
    this.buildingsState.update((buildings) =>
      buildings.map((building) =>
        building.id === buildingId ? { ...building, floors: update(building.floors) } : building,
      ),
    );
  }

  private updateSpaces(
    buildingId: string,
    floorId: string,
    update: (spaces: Space[]) => Space[],
  ): void {
    this.updateFloors(buildingId, (floors) =>
      floors.map((floor) =>
        floor.id === floorId ? { ...floor, spaces: update(floor.spaces) } : floor,
      ),
    );
  }
}
