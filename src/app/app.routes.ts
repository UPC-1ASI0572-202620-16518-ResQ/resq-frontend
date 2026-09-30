import { Routes } from '@angular/router';

import { AppShellComponent } from './layout/app-shell/app-shell.component';

import { LoginPage } from './features/auth/login.page';

import { DashboardPage } from './features/dashboard/dashboard.page';

import {
  BuildingsPage,
  BuildingDetailPage,
} from './features/buildings/buildings.pages';

import {
  BuildingCreatePage,
} from './features/buildings/building-create/building-create.page';

import { FloorPlanEditorPage } from './features/buildings/floor-plan-editor/floor-plan-editor.page';

import {
  SpacesPage,
  SpaceDetailPage,
} from './features/spaces/spaces.pages';

import {
  DevicesPage,
  DeviceDetailPage,
} from './features/devices/devices.pages';

import {
  AlertsPage,
  AlertDetailPage,
} from './features/alerts/alerts.pages';

import {
  IncidentsPage,
  IncidentDetailPage,
} from './features/incidents/incidents.pages';


import { SettingsPage } from './features/settings/settings.page';

import { NotFoundPage } from './features/not-found.page';
import { authGuard } from './features/auth/auth.guard';


export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
  },

  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],

    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },

      {
        path: 'dashboard',
        component: DashboardPage,
      },

      {
        path: 'buildings',
        component: BuildingsPage,
      },

      {
        path: 'buildings/new',
        component: BuildingCreatePage,
      },

      {
        path: 'buildings/:buildingId/edit',
        component: BuildingCreatePage,
      },

      {
        path: 'buildings/:buildingId/floors/:floorId/editor',
        component: FloorPlanEditorPage,
      },

      {
        path: 'buildings/:buildingId',
        component: BuildingDetailPage,
      },

      {
        path: 'monitoring',
        loadComponent: () =>
          import('./features/monitoring/floor-monitoring.page')
            .then(module => module.FloorMonitoringPage),
      },

      {
        path: 'monitoring/:buildingId/floors/:floorId',
        loadComponent: () =>
          import('./features/monitoring/floor-monitoring.page')
            .then(module => module.FloorMonitoringPage),
      },

      {
        path: 'spaces',
        component: SpacesPage,
      },

      {
        path: 'spaces/:spaceId',
        component: SpaceDetailPage,
      },

      {
        path: 'devices',
        component: DevicesPage,
      },

      {
        path: 'devices/:deviceId',
        component: DeviceDetailPage,
      },

      {
        path: 'alerts',
        component: AlertsPage,
      },

      {
        path: 'alerts/:alertId',
        component: AlertDetailPage,
      },

      {
        path: 'incidents',
        component: IncidentsPage,
      },

      {
        path: 'incidents/:incidentId',
        component: IncidentDetailPage,
      },

      {
        path: 'analytics',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },

      {
        path: 'settings',
        component: SettingsPage,
      },

      {
        path: '**',
        component: NotFoundPage,
      },
    ],
  },
];
