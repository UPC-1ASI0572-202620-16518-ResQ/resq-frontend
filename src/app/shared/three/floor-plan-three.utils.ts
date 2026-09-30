import * as THREE from 'three';
import { FloorPlanPoint, RiskStatus } from '../../core/models/resq.models';

export const FLOOR_PLAN_SCALE = .02;

export function floorPlanToWorldCoordinates(point: FloorPlanPoint): { x: number; z: number } {
  return { x: (point.x - 500) * FLOOR_PLAN_SCALE, z: (250 - point.y) * FLOOR_PLAN_SCALE };
}

export function floorPlanShape(points: FloorPlanPoint[]): THREE.Shape {
  const first = floorPlanToWorldCoordinates(points[0]);
  const shape = new THREE.Shape();
  shape.moveTo(first.x, first.z);
  for (const point of points.slice(1)) {
    const world = floorPlanToWorldCoordinates(point);
    shape.lineTo(world.x, world.z);
  }
  shape.closePath();
  return shape;
}

export function riskColor(status: RiskStatus): number {
  return ({ Normal: 0x67c98f, Warning: 0xf4bd57, Critical: 0xe65f57, Offline: 0x9aa6b2 })[status];
}
