import { mapCatalogBuildingToPresentation } from './building-legacy.mapper';

describe('building floor persistence regression', () => {
  it('keeps independently persisted empty floors with stable identities and order', () => {
    const now = new Date();
    const building = mapCatalogBuildingToPresentation({
      id: 'building-1', organizationId: 'org-1', buildingCode: 'BLDG', name: 'Building',
      address: { streetAddress: 'Street', district: 'District', city: 'City', countryCode: 'PE' },
      administrativeStatus: 'ACTIVE', zones: [], createdAt: now, updatedAt: now, version: 1,
      floors: [
        { id: 'floor-3', buildingId: 'building-1', label: 'Floor 3', level: 3, createdAt: now, updatedAt: now },
        { id: 'floor-1', buildingId: 'building-1', label: 'Floor 1', level: 1, createdAt: now, updatedAt: now },
        { id: 'floor-2', buildingId: 'building-1', label: 'Floor 2', level: 2, createdAt: now, updatedAt: now },
      ],
    });

    expect(building.floors.map(floor => floor.id)).toEqual(['floor-1', 'floor-2', 'floor-3']);
    expect(building.floors.every(floor => floor.spaces.length === 0)).toBe(true);
  });
});
