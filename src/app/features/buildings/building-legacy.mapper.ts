import { Building, Floor, RiskStatus, Space, riskRank } from '../../core/models/resq.models';
import { AlertWorkspaceRow } from '../alerts/alert-workspace.facade';
import { BuildingCatalogRecord, ZoneCatalogRecord } from './data-access/building.gateway';

export function mapCatalogBuildingToPresentation(
  building: BuildingCatalogRecord,
  alerts: AlertWorkspaceRow[] = [],
): Building {
  const groups = new Map<string, ZoneCatalogRecord[]>();
  for (const zone of building.zones) {
    const label = zone.floorLabel?.trim() || 'Zones';
    groups.set(label, [...(groups.get(label) ?? []), zone]);
  }

  const persistedFloors = building.floors.length
    ? [...building.floors].sort((a, b) => a.level - b.level)
    : [...groups.keys()].map((label, index) => ({
        id: `${building.id}:legacy-floor:${label}`,
        buildingId: building.id,
        label,
        level: index + 1,
        createdAt: building.createdAt,
        updatedAt: building.updatedAt,
      }));

  const floors: Floor[] = persistedFloors.map((persisted) => {
    const label = persisted.label;
    const zones = groups.get(label) ?? [];
    const spaces = zones.map((zone) => mapZone(zone, alerts));
    return {
      id: persisted.id,
      buildingId: building.id,
      name: label,
      level: persisted.level,
      spaces: spaces.map(space => ({ ...space, floorId: persisted.id })),
      status: highest(spaces.map((space) => space.status)),
      planElements: [],
      planConfigured: false,
      hasLiveData: spaces.some(space => space.hasLiveData),
    };
  });

  return {
    id: building.id,
    name: building.name,
    address: [
      building.address.streetAddress,
      building.address.district,
      building.address.city,
      building.address.countryCode,
    ].filter(Boolean).join(', '),
    description: building.description,
    floors,
    status: highest(floors.map((floor) => floor.status)),
    hasLiveData: floors.some(floor => floor.hasLiveData),
  };
}

function mapZone(zone: ZoneCatalogRecord, alerts: AlertWorkspaceRow[]): Space {
  const active = alerts.filter((alert) => alert.status === 'ACTIVE' && alert.location.zoneId === zone.id);
  const status: RiskStatus = active.some((alert) => alert.severity.toUpperCase() === 'CRITICAL')
    ? 'Critical'
    : active.length
      ? 'Warning'
      : 'Normal';
  return {
    id: zone.id,
    floorId: '',
    buildingId: zone.buildingId,
    name: zone.name,
    roomNumber: zone.zoneCode,
    type: 'Other',
    sensitivity: 'Normal',
    configurationPersisted: false,
    hasLiveData: false,
    status,
    thresholds: {},
    polygon: [],
    devices: [],
  };
}

function highest(statuses: RiskStatus[]): RiskStatus {
  return statuses.reduce(
    (current, status) => riskRank[status] > riskRank[current] ? status : current,
    'Normal',
  );
}
