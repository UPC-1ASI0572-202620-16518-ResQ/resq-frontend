export interface ContactInformationResourceDto {
  email: string;

  phoneNumber: string;
}

export interface UserPreferencesResourceDto {
  language: string;

  timeZone: string;

  receiveSMSAlerts: boolean;
}

export interface UserProfileResourceDto {
  userId: string;

  firstName: string;

  lastName: string;

  contactInformation:
    ContactInformationResourceDto;

  preferences:
    UserPreferencesResourceDto;
}

export interface UpdateContactInformationResourceDto {
  email: string;

  phoneNumber: string;
}

export interface UpdateUserPreferencesResourceDto {
  language?: string;

  timeZone?: string;

  receiveSMSAlerts?: boolean;
}