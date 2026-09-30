import {
  User,
} from '../../../core/models/resq.models';

import {
  UserProfileResourceDto,
} from './user.dto';

import {
  UserProfileRecord,
} from './user.gateway';

export function mapUserProfileResourceDto(
  dto:
    UserProfileResourceDto,
):
  UserProfileRecord {

  return {
    userId:
      dto.userId,

    firstName:
      dto.firstName,

    lastName:
      dto.lastName,

    contactInformation: {

      email:
        dto.contactInformation
          .email,

      phoneNumber:
        dto.contactInformation
          .phoneNumber,
    },

    preferences: {

      language:
        dto.preferences
          .language,

      timeZone:
        dto.preferences
          .timeZone,

      receiveSMSAlerts:
        dto.preferences
          .receiveSMSAlerts,
    },
  };
}

/**
 * Temporary compatibility mapper for the existing
 * frontend User model.
 *
 * The legacy User contains:
 *
 * - id
 * - name
 * - email
 * - initials
 *
 * but does NOT contain:
 *
 * - phone number
 * - language
 * - time zone
 * - SMS preferences
 *
 * Missing values are deliberately left undefined
 * rather than fabricated.
 */
export function mapLegacyUserToProfile(
  user:
    User,
):
  UserProfileRecord {

  const {
    firstName,
    lastName,
  } = splitLegacyName(
    user.name,
  );

  return {
    userId:
      user.id,

    firstName,

    lastName,

    contactInformation: {

      email:
        user.email,

      phoneNumber:
        undefined,
    },

    preferences: {

      language:
        undefined,

      timeZone:
        undefined,

      receiveSMSAlerts:
        undefined,
    },
  };
}

export function cloneUserProfile(
  profile:
    UserProfileRecord,
):
  UserProfileRecord {

  return {
    ...profile,

    contactInformation: {
      ...profile
        .contactInformation,
    },

    preferences: {
      ...profile.preferences,
    },
  };
}

function splitLegacyName(
  value:
    string,
): {
  firstName: string;
  lastName: string;
} {

  const parts =
    value
      .trim()
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      );

  if (
    parts.length === 0
  ) {

    return {
      firstName:
        '',

      lastName:
        '',
    };
  }

  if (
    parts.length === 1
  ) {

    return {
      firstName:
        parts[0],

      lastName:
        '',
    };
  }

  return {
    firstName:
      parts[0],

    lastName:
      parts
        .slice(
          1,
        )
        .join(
          ' ',
        ),
  };
}