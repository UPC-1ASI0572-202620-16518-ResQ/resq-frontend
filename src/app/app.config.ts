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
  provideDeviceDataAccess,
} from './features/devices/data-access/device.providers';

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

      provideDeviceDataAccess(
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