import {
  isPointInsideFloorPlan,
  isPointInsideVisualArea,
  visualPlacementForAssignedZone,
} from './floor-plan-placement.utils';

describe('floor plan device positioning', () => {
  const zone = { id: 'zone-lab' };
  const assigned = { spaceId: 'zone-lab' };

  it('allows positions in unlinked rooms, corridors, and restrooms without changing zone assignment', () => {
    for (const point of [{ x: 160, y: 170 }, { x: 500, y: 250 }, { x: 790, y: 410 }]) {
      expect(visualPlacementForAssignedZone(assigned, point, [zone])).toEqual({
        zoneId: zone.id, position: point,
      });
    }
  });

  it('rejects points outside the floor and unrecognized zone assignments', () => {
    expect(isPointInsideFloorPlan({ x: 1000, y: 500 })).toBe(true);
    expect(isPointInsideFloorPlan({ x: -1, y: 250 })).toBe(false);
    expect(isPointInsideFloorPlan({ x: 1010, y: 250 })).toBe(false);
    expect(visualPlacementForAssignedZone(assigned, { x: 150, y: 200 }, [{ id: 'another-zone' }])).toBeUndefined();
    expect(visualPlacementForAssignedZone(assigned, { x: 150, y: 510 }, [zone])).toBeUndefined();
  });

  it('preserves devices positioned outside a visual area when that area changes', () => {
    const room = { x: 100, y: 100, width: 200, height: 150 };
    expect(isPointInsideVisualArea({ x: 150, y: 120 }, room)).toBe(true);
    expect(isPointInsideVisualArea({ x: 450, y: 120 }, room)).toBe(false);
    expect(isPointInsideVisualArea(undefined, room)).toBe(false);
  });
});
