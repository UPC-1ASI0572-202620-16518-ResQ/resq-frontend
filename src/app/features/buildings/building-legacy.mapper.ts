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

  const floors: Floor[] = [...groups.entries()].map(([label, zones], index) => {
    const spaces = zones.map((zone) => mapZone(zone, alerts));
    return {
      id: `${building.id}:floor:${label}`,
      buildingId: building.id,
      name: label,
      level: index + 1,
      spaces,
      status: highest(spaces.map((space) => space.status)),
      planElements: [],
      planConfigured: false,
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
    floorId: `${zone.buildingId}:floor:${zone.floorLabel?.trim() || 'Zones'}`,
    buildingId: zone.buildingId,
    name: zone.name,
    roomNumber: zone.zoneCode,
    type: 'Other',
    sensitivity: 'Normal',
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
