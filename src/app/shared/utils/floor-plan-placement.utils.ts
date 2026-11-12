import { Device, FloorPlanPoint, FloorPlanPosition, Space } from '../../core/models/resq.models';

/** The full logical 2D floor; does not require a monitored polygon beneath the device. */
export const FLOOR_PLAN_WIDTH = 1000;
export const FLOOR_PLAN_HEIGHT = 500;

export interface VisualDevicePlacement {
  /** Stable administrative zone; never inferred from the drawing beneath the cursor. */
  zoneId: string;
  position: FloorPlanPosition;
}

export function isPointInsideFloorPlan(point: FloorPlanPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= FLOOR_PLAN_WIDTH &&
    point.y >= 0 && point.y <= FLOOR_PLAN_HEIGHT;
}

/** Allows display anywhere on the floor (unlinked area, hallway, restroom, etc.). */
export function visualPlacementForAssignedZone(
  device: Pick<Device, 'spaceId'> | undefined,
  position: FloorPlanPoint,
  zones: ReadonlyArray<Pick<Space, 'id'>>,
): VisualDevicePlacement | undefined {
  if (!device || !isPointInsideFloorPlan(position)) return undefined;
  if (!zones.some(zone => zone.id === device.spaceId)) return undefined;
  return { zoneId: device.spaceId, position: { ...position } };
}

/** Used when geometry changes: unrelated devices must not move with a drawn room. */
export function isPointInsideVisualArea(
  point: FloorPlanPoint | undefined,
  area: { x: number; y: number; width: number; height: number },
): boolean {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= area.x && point.x <= area.x + area.width &&
    point.y >= area.y && point.y <= area.y + area.height;
}
