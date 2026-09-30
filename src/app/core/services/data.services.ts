import { Injectable, computed, signal } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { ALERTS, BUILDINGS, DEMO_USER, DEVICES, FLOORS, INCIDENTS, SPACES } from '../mock-data/resq.mock';
import { Alert, AlertStatus, Building, Device, Floor, Incident, IncidentStatus, SearchResult, Space, SpaceThresholds, User } from '../models/resq.models';

@Injectable({ providedIn: 'root' })
export class ResqStore {
  readonly buildings = signal<Building[]>(BUILDINGS);
  readonly devices = signal<Device[]>(DEVICES);
  readonly alerts = signal<Alert[]>(ALERTS);
  readonly incidents = signal<Incident[]>(INCIDENTS);
  readonly activeAlerts = computed(() => this.alerts().filter(alert => alert.status !== 'Resolved'));
}

@Injectable({ providedIn: 'root' })
export class BuildingService {
  private readonly store = new ResqStore();
  getBuildings(): Observable<Building[]> { return of(this.store.buildings()).pipe(delay(150)); }
  getBuildingById(id: string): Observable<Building | undefined> { return of(this.store.buildings().find(item => item.id === id)).pipe(delay(100)); }
}

@Injectable({ providedIn: 'root' })
export class FloorService {
  getFloorsByBuilding(buildingId: string): Observable<Floor[]> { return of(FLOORS.filter(item => item.buildingId === buildingId)).pipe(delay(100)); }
  getFloorById(id: string): Observable<Floor | undefined> { return of(FLOORS.find(item => item.id === id)).pipe(delay(80)); }
}

@Injectable({ providedIn: 'root' })
export class SpaceService {
  private readonly spaces = signal<Space[]>(SPACES);
  getSpaces(): Observable<Space[]> { return of(this.spaces()).pipe(delay(120)); }
  getSpacesByFloor(floorId: string): Observable<Space[]> { return of(this.spaces().filter(item => item.floorId === floorId)).pipe(delay(100)); }
  getSpaceById(id: string): Observable<Space | undefined> { return of(this.spaces().find(item => item.id === id)).pipe(delay(80)); }
  updateConfiguration(id: string, sensitivity: Space['sensitivity'], thresholds: SpaceThresholds): void {
    this.spaces.update(items => items.map(item => item.id === id ? { ...item, sensitivity, thresholds } : item));
  }
}

@Injectable({ providedIn: 'root' })
export class DeviceService {
  getDevices(): Observable<Device[]> { return of(DEVICES).pipe(delay(120)); }
  getDeviceById(id: string): Observable<Device | undefined> { return of(DEVICES.find(item => item.id === id)).pipe(delay(80)); }
  getDevicesBySpace(spaceId: string): Observable<Device[]> { return of(DEVICES.filter(item => item.spaceId === spaceId)).pipe(delay(80)); }
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly items = signal<Alert[]>(ALERTS);
  readonly alerts = this.items.asReadonly();
  readonly activeAlerts = computed(() => this.items().filter(alert => alert.status !== 'Resolved'));
  getAlerts(): Observable<Alert[]> { return of(this.items()).pipe(delay(120)); }
  getAlertById(id: string): Observable<Alert | undefined> { return of(this.items().find(item => item.id === id)).pipe(delay(80)); }
  getAlertsBySpace(spaceId: string): Observable<Alert[]> { return of(this.items().filter(item => item.spaceId === spaceId)).pipe(delay(80)); }
  updateStatus(id: string, status: AlertStatus): void { this.items.update(items => items.map(item => item.id === id ? { ...item, status } : item)); }
}

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly items = signal<Incident[]>(INCIDENTS);
  readonly incidents = this.items.asReadonly();
  getIncidents(): Observable<Incident[]> { return of(this.items()).pipe(delay(120)); }
  getIncidentById(id: string): Observable<Incident | undefined> { return of(this.items().find(item => item.id === id)).pipe(delay(80)); }
  updateStatus(id: string, status: IncidentStatus): void { this.items.update(items => items.map(item => item.id === id ? { ...item, status, resolvedAt: status === 'Resolved' ? new Date() : undefined } : item)); }
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  search(query: string): Observable<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return of([]);
    const results: SearchResult[] = [
      ...BUILDINGS.filter(item => item.name.toLowerCase().includes(q)).map(item => ({ id: item.id, type: 'Building' as const, title: item.name, subtitle: item.address, route: `/buildings/${item.id}` })),
      ...SPACES.filter(item => `${item.name} ${item.roomNumber}`.toLowerCase().includes(q)).slice(0, 6).map(item => ({ id: item.id, type: 'Space' as const, title: item.name, subtitle: `Room ${item.roomNumber ?? '—'}`, route: `/spaces/${item.id}` })),
      ...DEVICES.filter(item => `${item.name} ${item.code}`.toLowerCase().includes(q)).slice(0, 6).map(item => ({ id: item.id, type: 'Device' as const, title: item.name, subtitle: item.code, route: `/devices/${item.id}` })),
    ];
    return of(results.slice(0, 10)).pipe(delay(100));
  }
}

@Injectable({ providedIn: 'root' })
export class AuthMockService {
  readonly currentUser = signal<User | null>(null);
  login(email: string, password: string): boolean {
    const valid = email === 'admin@resq.io' && password === 'password123';
    if (valid) this.currentUser.set(DEMO_USER);
    return valid;
  }
  logout(): void { this.currentUser.set(null); }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  summary() { return { buildings: BUILDINGS.length, devices: DEVICES.length, activeAlerts: ALERTS.filter(item => item.status !== 'Resolved').length, criticalSpaces: SPACES.filter(item => item.status === 'Critical').length }; }
}
