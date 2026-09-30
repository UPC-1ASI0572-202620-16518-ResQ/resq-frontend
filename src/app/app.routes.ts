import { Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { LoginPage } from './features/auth/login.page';
import { DashboardPage } from './features/dashboard/dashboard.page';
import { BuildingsPage, BuildingDetailPage } from './features/buildings/buildings.pages';
import { FloorMonitoringPage } from './features/monitoring/floor-monitoring.page';
import { SpacesPage, SpaceDetailPage } from './features/spaces/spaces.pages';
import { DevicesPage, DeviceDetailPage } from './features/devices/devices.pages';
import { AlertsPage, AlertDetailPage } from './features/alerts/alerts.pages';
import { IncidentsPage, IncidentDetailPage } from './features/incidents/incidents.pages';
import { AnalyticsPage } from './features/analytics/analytics.page';
import { SettingsPage } from './features/settings/settings.page';
import { NotFoundPage } from './features/not-found.page';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: '', component: AppShellComponent, children: [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    { path: 'dashboard', component: DashboardPage },
    { path: 'buildings', component: BuildingsPage },
    { path: 'buildings/:buildingId', component: BuildingDetailPage },
    { path: 'monitoring', component: FloorMonitoringPage },
    { path: 'monitoring/:buildingId/floors/:floorId', component: FloorMonitoringPage },
    { path: 'spaces', component: SpacesPage },
    { path: 'spaces/:spaceId', component: SpaceDetailPage },
    { path: 'devices', component: DevicesPage },
    { path: 'devices/:deviceId', component: DeviceDetailPage },
    { path: 'alerts', component: AlertsPage },
    { path: 'alerts/:alertId', component: AlertDetailPage },
    { path: 'incidents', component: IncidentsPage },
    { path: 'incidents/:incidentId', component: IncidentDetailPage },
    { path: 'analytics', component: AnalyticsPage },
    { path: 'settings', component: SettingsPage },
    { path: '**', component: NotFoundPage },
  ]},
];
