export interface UserProfileResourceDto {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
}

export interface UpdateContactInformationResourceDto {
  email: string | null;
  phoneNumber: string | null;
}

export interface UpdateUserPreferencesResourceDto {
  language?: string;

  timeZone?: string;

  receiveSMSAlerts?: boolean;
}
