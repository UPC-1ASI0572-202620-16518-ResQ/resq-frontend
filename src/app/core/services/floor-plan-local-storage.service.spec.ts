import { BuildingStoreService } from './building-store.service';
import { FloorPlanLocalStorageService, StoredFloorPlan } from './floor-plan-local-storage.service';

describe('FloorPlanLocalStorageService regression', () => {
  it('keeps visual areas and structural elements when their zone is absent', () => {
    const store = new BuildingStoreService();
    store.replaceBuildings([{
      id: 'building-1', name: 'Test', address: 'Test', status: 'Normal', floors: [{
        id: 'floor-1', buildingId: 'building-1', name: 'Floor 1', level: 1,
        status: 'Normal', planElements: [], spaces: [{
          id: 'zone-real', buildingId: 'building-1', floorId: 'floor-1', name: 'Real zone',
          type: 'Other', sensitivity: 'Normal', status: 'Normal', thresholds: {}, polygon: [], devices: [],
        }],
      }],
    }]);
    const state: StoredFloorPlan = {
      version: 1, buildingId: 'building-1', floorLabel: 'Floor 1', updatedAt: new Date().toISOString(),
      elements: [
        { id: 'linked', type: 'Space', spaceId: 'zone-real', x: 0, y: 0, width: 100, height: 80 },
        { id: 'temporary', type: 'Space', spaceId: 'temp-zone', x: 110, y: 0, width: 100, height: 80 },
        { id: 'unlinked', type: 'Space', x: 220, y: 0, width: 100, height: 80 },
        { id: 'door', type: 'Door', x: 100, y: 35, width: 10, height: 8 },
        { id: 'hallway', type: 'Hallway', x: 0, y: 90, width: 320, height: 40 },
      ],
      spaces: [{ spaceId: 'zone-real', polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }] }],
      devices: [],
    };

    expect(new FloorPlanLocalStorageService().restoreStateToStore(store, 'building-1', 'floor-1', state)).toBe(true);
    const restored = store.getFloor('building-1', 'floor-1')!.planElements!;
    expect(restored.map(item => item.id)).toEqual(['linked', 'temporary', 'unlinked', 'door', 'hallway']);
    expect(restored.find(item => item.id === 'temporary')?.spaceId).toBeUndefined();
    expect(restored.find(item => item.id === 'unlinked')?.label).toBe('Unmonitored area');
  });
});
