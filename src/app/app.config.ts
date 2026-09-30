import {
  provideHttpClient,
} from '@angular/common/http';

import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';

import {
  provideRouter,
} from '@angular/router';

import {
  provideAnimationsAsync,
} from '@angular/platform-browser/animations/async';

import {
  provideCharts,
  withDefaultRegisterables,
} from 'ng2-charts';

import {
  API_CONFIG,
  DEFAULT_API_CONFIG,
} from './core/api/api.config';

import {
  provideAlertResponseDataAccess,
} from './features/alerts/data-access/alert.providers';

import {
  provideIamDataAccess,
} from './features/auth/data-access/iam.providers';

import {
  provideBuildingDataAccess,
} from './features/buildings/data-access/building.providers';

import {
  provideConnectivityDataAccess,
} from './features/connectivity/data-access/connectivity.providers';

import {
  provideDeviceDataAccess,
} from './features/devices/data-access/device.providers';

import {
  provideIncidentDataAccess,
} from './features/incidents/data-access/incident.providers';

import {
  provideMonitoringDataAccess,
} from './features/monitoring/data-access/monitoring.providers';

import {
  provideRiskDetectionDataAccess,
} from './features/risk-detection/data-access/risk-detection.providers';

import {
  provideUserDataAccess,
} from './features/users/data-access/user.providers';

import {
  routes,
} from './app.routes';

export const appConfig:
  ApplicationConfig = {

    providers: [

      provideBrowserGlobalErrorListeners(),

      provideRouter(
        routes,
      ),

      provideAnimationsAsync(),

      provideHttpClient(),

      provideIamDataAccess(),

      provideUserDataAccess(
        'mock',
      ),

      provideBuildingDataAccess(
        'mock',
      ),

      provideDeviceDataAccess(
        'mock',
      ),

      provideConnectivityDataAccess(
        'mock',
      ),

      provideMonitoringDataAccess(),

      provideRiskDetectionDataAccess(),

      provideAlertResponseDataAccess(),

      provideIncidentDataAccess(
        'mock',
      ),

      provideCharts(
        withDefaultRegisterables(),
      ),

      {
        provide:
          API_CONFIG,

        useValue:
          DEFAULT_API_CONFIG,
      },
    ],
  };