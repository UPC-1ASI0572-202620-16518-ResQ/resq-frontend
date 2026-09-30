import { Device, FloorPlanPosition } from '../../core/models/resq.models';

/** Returns a render-only offset for colocated devices without changing stored coordinates. */
export function visualDevicePosition(devices: Device[], index: number, radius = 9): FloorPlanPosition | undefined {
  const position = devices[index]?.floorPlanPosition;
  if (!position) return undefined;
  const colocated = devices
    .map((device, deviceIndex) => ({ device, deviceIndex }))
    .filter(item => item.device.floorPlanPosition?.x === position.x && item.device.floorPlanPosition?.y === position.y);
  if (colocated.length < 2) return position;
  const occurrence = colocated.findIndex(item => item.deviceIndex === index);
  const angle = (occurrence / colocated.length) * Math.PI * 2 - Math.PI / 2;
  return { x: position.x + Math.cos(angle) * radius, y: position.y + Math.sin(angle) * radius };
}
