export type IncidentStatusDto =
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export type IncidentRiskTypeDto =
  | 'EARTHQUAKE'
  | 'FIRE'
  | 'GAS_LEAK'
  | 'UNKNOWN';

export type IncidentRiskLevelDto =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export interface IncidentResourceDto {
  incidentId: string;

  zoneId: string;

  type:
    IncidentRiskTypeDto;

  level:
    IncidentRiskLevelDto;

  status:
    IncidentStatusDto;

  assignedTo?:
    string
    | null;

  createdAt:
    string;

  resolvedAt?:
    string
    | null;

  resolutionNotes?:
    string
    | null;
}

export interface IncidentPageResourceDto {
  items:
    IncidentResourceDto[];

  page:
    number;

  size:
    number;

  totalElements:
    number;

  totalPages:
    number;
}

export interface AssignIncidentResourceDto {
  attendantId: string;
}

export interface ResolveIncidentResourceDto {
  resolutionNotes: string;
}