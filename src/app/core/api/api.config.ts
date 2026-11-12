import {
  InjectionToken,
} from '@angular/core';

import { environment } from '../../../environments/environment';

export interface ApiConfig {
  baseUrl: string;
  requestTimeoutMs: number;
}

export const API_CONFIG =
  new InjectionToken<ApiConfig>(
    'RESQ_API_CONFIG',
  );

export const DEFAULT_API_CONFIG:
  ApiConfig = {
    baseUrl: environment.apiBaseUrl,
    requestTimeoutMs: 15_000,
  };

export function buildApiUrl(
  config: ApiConfig,
  path: string,
): string {

  const normalizedBaseUrl =
    config.baseUrl.replace(
      /\/+$/,
      '',
    );

  const normalizedPath =
    path.startsWith('/')
      ? path
      : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}
