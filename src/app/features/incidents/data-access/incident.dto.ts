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
  id: string;
  organizationId: string;
  riskDetectionId?: string | null;
  alertId?: string | null;

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

  assignedUserId?: number | null;

  /** TODO(OpenAPI): compatibility fields pending final Incident schema. */
  assignedAt?: string | null;
  resolvedByUserId?: number | null;
  closedAt?: string | null;
  closedByUserId?: number | null;
  safetyVerified?: boolean;
  humanActions?: IncidentHumanActionResourceDto[];
  safetyVerifications?: IncidentSafetyVerificationResourceDto[];

  createdAt:
    string;

  resolvedAt?:
    string
    | null;

  resolutionNotes?:
    string
    | null;
}

export interface IncidentHumanActionResourceDto {
  id: string;
  userId: number;
  actionCode: string;
  notes?: string | null;
  performedAt: string;
}

export interface IncidentSafetyVerificationResourceDto {
  id: string;
  verifiedByUserId: number;
  safe: boolean;
  reason: string;
  deviceId?: string | null;
  measurementId?: string | null;
  measuredValue?: number | null;
  measuredAt?: string | null;
  ruleSnapshot?: string | null;
  verifiedAt: string;
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

export interface UpdateIncidentStatusResourceDto {
  status: 'Closed';
}
