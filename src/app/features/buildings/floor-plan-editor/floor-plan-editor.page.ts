import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  effect,
  untracked,
  computed,
  inject,
  signal,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import {
  capabilityCategory,
  capabilityDefinition,
  defaultThresholds,
  deviceDefinition,
} from '../../../core/models/device-domain';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  Building,
  Device,
  DeviceType,
  DeviceCapabilityCategory,
  Floor,
  FloorPlanElement,
  FloorPlanElementType,
  FloorPlanPoint,
  SensitivityLevel,
  Space,
  SpaceThresholds,
  SpaceType,
  ResponseRule,
} from '../../../core/models/resq.models';
import { BuildingStoreService } from '../../../core/services/building-store.service';
import { FloorPlanLocalStorageService } from '../../../core/services/floor-plan-local-storage.service';
import { FloorPlanRemoteService } from '../../../core/services/floor-plan-remote.service';
import { FloorPlanHydrationService } from '../../../core/services/floor-plan-hydration.service';
import { SensorResponseService } from '../../../core/services/sensor-response.service';
import { visualDevicePosition } from '../../../shared/utils/floor-plan-device.utils';
import { visualPlacementForAssignedZone, isPointInsideVisualArea } from '../../../shared/utils/floor-plan-placement.utils';
import { DeviceWorkspaceFacade } from '../../devices/device-workspace.facade';
import { BuildingFacade } from '../data-access/building.facade';
import { switchMap } from 'rxjs';

type EditorTool =
  'Select' | 'Area' | 'Hallway' | 'Wall' | 'Door' | 'Stairs' | 'Restroom' | 'Device' | 'Pan';
type Selection = { kind: 'area' | 'element' | 'device'; id: string };
interface DragState {
  mode: 'draw' | 'move' | 'resize' | 'pan' | 'device';
  start: FloorPlanPoint;
  current: FloorPlanPoint;
  selection?: Selection;
  originalElement?: FloorPlanElement;
  originalSpace?: Space;
  originalDevice?: Device;
  deviceMoved?: boolean;
  dirtyBefore?: boolean;
  originalView?: FloorPlanPoint;
  invalidPlacement?: boolean;
}
interface EditorSnapshot {
  spaces: Space[];
  elements: FloorPlanElement[];
  image?: string;
  rules: ResponseRule[];
}
interface AssignmentConflict {
  areaId: string;
  targetSpaceId: string;
  otherAreaId: string;
}

@Component({
  selector: 'resq-floor-plan-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatSnackBarModule,
    A11yModule,
  ],
  templateUrl: './floor-plan-editor.page.html',
  styleUrls: ['./floor-plan-editor.page.scss', './floor-plan-editor.area.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloorPlanEditorPage implements OnInit {
  @ViewChild('canvas') private canvas?: ElementRef<SVGSVGElement>;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(BuildingStoreService);
  private readonly localPlans = inject(FloorPlanLocalStorageService);
  private readonly remotePlans = inject(FloorPlanRemoteService);
  private readonly planHydration = inject(FloorPlanHydrationService);
  private readonly snackBar = inject(MatSnackBar);
  readonly response = inject(SensorResponseService);
  private readonly deviceWorkspace = inject(DeviceWorkspaceFacade);
  private readonly buildingWorkspace = inject(BuildingFacade);

  readonly building = signal<Building | undefined>(undefined);
  readonly floor = signal<Floor | undefined>(undefined);
  readonly spaces = signal<Space[]>([]);
  readonly elements = signal<FloorPlanElement[]>([]);
  readonly planImageUrl = signal<string | undefined>(undefined);
  readonly imageError = signal<string | undefined>(undefined);
  readonly selectedTool = signal<EditorTool>('Select');
  readonly selection = signal<Selection | undefined>(undefined);
  readonly draft = signal<{ x: number; y: number; width: number; height: number } | undefined>(
    undefined,
  );
  readonly gridVisible = signal(true);
  readonly snapEnabled = signal(true);
  readonly zoom = signal(1);
  readonly viewOrigin = signal({ x: 0, y: 0 });
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  readonly assignmentConflict = signal<AssignmentConflict | undefined>(undefined);
  readonly deleteCandidate = signal<FloorPlanElement | undefined>(undefined);
  readonly hasUnsavedChanges = signal(false);
  readonly planSyncStatus = signal<'LOADING' | 'SYNCING' | 'SYNCED' | 'LOCAL_ONLY' | 'EMPTY' | 'ERROR'>('LOADING');
  readonly planSyncMessage = computed(() => {
    if (this.hasUnsavedChanges()) return 'Changes pending synchronization.';
    switch (this.planSyncStatus()) {
      case 'SYNCED': return 'Floor plan synchronized with the server.';
      case 'LOCAL_ONLY': return 'Floor plan available only in this browser; save again to synchronize it.';
      case 'ERROR': return 'The remote version could not be verified; current data was not replaced.';
      case 'EMPTY': return 'This floor does not have a saved plan yet.';
      case 'SYNCING': return 'Synchronizing floor plan with the server…';
      default: return 'Checking the remote floor plan…';
    }
  });
  readonly pendingFloorId = signal<string | undefined>(undefined);
  readonly leftPanel = signal<'areas' | 'devices'>('areas');
  readonly deviceCategory = signal<'SENSOR' | 'ACTUATOR' | 'DISPLAY'>('SENSOR');
  readonly propertiesOpen = signal(false);
  readonly creationSpaceId = signal('');
  readonly deviceDialogOpen = signal(false);
  readonly deviceDialogMode = signal<'existing' | 'new'>('existing');
  readonly deviceDialogBusy = signal(false);
  readonly deviceFormError = signal('');
  /** Only persisted zones for the current floor; risk status is never an assignment filter. */
  readonly registrationZones = computed(() => this.spaces().filter(space =>
    space.buildingId === this.building()?.id &&
    space.floorId === this.floor()?.id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(space.id),
  ));
  readonly sensorVariables = [
    { code: 'TEMPERATURE', label: 'Temperatura (°C)' },
    { code: 'GAS_PPM', label: 'Gas (ppm)' },
    { code: 'SMOKE_PPM', label: 'Humo (ppm)' },
    { code: 'HUMIDITY', label: 'Humedad (%)' },
    { code: 'MOTION', label: 'Movimiento (eventos)' },
  ];
  readonly actuatorCapabilities = [
    { code: 'AUDIBLE_ALARM', label: 'Alarma sonora' },
    { code: 'VISUAL_STATUS_SIGNALING', label: 'Señalización visual / LED' },
    { code: 'ENVIRONMENTAL_VENTILATION', label: 'Ventilación / HVAC' },
    { code: 'MECHANICAL_SERVO', label: 'Servomotor' },
  ];
  existingDeviceId = '';
  newDeviceName = '';
  newDeviceCode = '';
  newDeviceVariable = 'TEMPERATURE';
  newDeviceUnit = 'C';

  readonly areaName = signal('');
  readonly areaRoomNumber = signal('');
  readonly areaType = signal<SpaceType>('Office');
  readonly areaSensitivity = signal<SensitivityLevel>('Normal');
  readonly linkedSpaceId = signal('');
  readonly spaceTypes: SpaceType[] = [
    'Laboratory',
    'Classroom',
    'Office',
    'ServerRoom',
    'Storage',
    'Kitchen',
    'Hallway',
    'Stairs',
    'Restroom',
    'MeetingRoom',
    'ControlRoom',
    'Reception',
    'Other',
  ];
  readonly sensitivityLevels: SensitivityLevel[] = ['Low', 'Normal', 'High', 'Custom'];
  readonly tools: Array<{ name: EditorTool; icon: string }> = [
    { name: 'Select', icon: 'near_me' },
    { name: 'Area', icon: 'meeting_room' },
    { name: 'Hallway', icon: 'view_stream' },
    { name: 'Wall', icon: 'horizontal_rule' },
    { name: 'Door', icon: 'door_front' },
    { name: 'Stairs', icon: 'stairs' },
    { name: 'Restroom', icon: 'wc' },
    { name: 'Device', icon: 'sensors' },
    { name: 'Pan', icon: 'pan_tool' },
  ];

  readonly areas = computed(() => this.elements().filter((element) => element.type === 'Space'));
  readonly deviceSpaces = computed(() =>
    this.areas().flatMap((area) => {
      const space = this.areaSpace(area);
      return space ? [{ ...space, polygon: this.rectPolygon(area) }] : [];
    }),
  );
  readonly selectedArea = computed(() => {
    const selected = this.selection();
    return selected?.kind === 'area'
      ? this.areas().find((area) => area.id === selected.id)
      : undefined;
  });
  readonly selectedAreaSpace = computed(() => {
    const spaceId = this.selectedArea()?.spaceId;
    return spaceId ? this.spaces().find((space) => space.id === spaceId) : undefined;
  });
  readonly selectedElement = computed(() => {
    const selected = this.selection();
    return selected?.kind === 'element'
      ? this.elements().find((element) => element.id === selected.id)
      : undefined;
  });
  readonly floorDevices = computed(() => {
    const seen = new Set<string>();
    return this.spaces()
      .flatMap((space) => this.devicesForSpace(space))
      .filter((device) => !seen.has(device.id) && !!seen.add(device.id));
  });
  readonly categorizedDevices = computed(() =>
    this.floorDevices().flatMap((device) =>
      device.capabilities
        .filter((capability) => capabilityCategory(capability) === this.deviceCategory())
        .map((capability) => ({ device, capability })),
    ),
  );
  readonly existingDeviceCandidates = computed(() => {
    const building = this.building();
    const floor = this.floor();
    if (!building || !floor) return [];
    const realZoneIds = new Set(this.spaces().map(space => space.id));
    const selectedZoneId = this.creationSpaceId();
    return this.deviceWorkspace.rows().filter(row =>
      row.catalog.assignment.buildingId === building.id &&
      !!row.catalog.assignment.zoneId &&
      realZoneIds.has(row.catalog.assignment.zoneId) &&
      (!selectedZoneId || row.catalog.assignment.zoneId === selectedZoneId) &&
      (row.location.floorId === floor.id || row.location.floorLabel === floor.name) &&
      row.capabilities.some(capability => capabilityCategory(capability) === this.deviceCategory()));
  });
  readonly selectedDevice = computed(() => {
    const selected = this.selection();
    return selected?.kind === 'device'
      ? this.floorDevices().find((device) => device.id === selected.id)
      : undefined;
  });
  readonly selectedDeviceSpace = computed(() => {
    const device = this.selectedDevice();
    return device ? this.spaces().find((space) => space.id === device.spaceId) : undefined;
  });
  readonly unassignedSpaces = computed(() => {
    const assigned = new Set(
      this.areas()
        .map((area) => area.spaceId)
        .filter(Boolean),
    );
    return this.spaces().filter((space) => !assigned.has(space.id));
  });
  readonly sortedFloors = computed(() =>
    [...(this.building()?.floors ?? [])].sort((a, b) => a.level - b.level),
  );
  readonly viewBox = computed(() => {
    const width = 1000 / this.zoom();
    const height = 500 / this.zoom();
    const origin = this.viewOrigin();
    return `${origin.x} ${origin.y} ${width} ${height}`;
  });

  private drag?: DragState;
  private undoStack: EditorSnapshot[] = [];
  private redoStack: EditorSnapshot[] = [];
  private uniqueCounter = 0;
  private deviceTargetAreaId?: string;
  private readonly restoredFloorKeys = new Set<string>();

  constructor() {
    effect(() => {
      const buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
      const floorId = this.route.snapshot.paramMap.get('floorId') ?? '';
      const floor = this.store.getFloor(buildingId, floorId);
      if (floor && !this.floor() && !this.hasUnsavedChanges()) {
        untracked(() => this.loadFloor(buildingId, floorId));
      }
    });
    effect(() => {
      const remoteDevices = this.store.devices();
      const selectedFloor = this.floor();
      if (!selectedFloor || this.hasUnsavedChanges()) return;
      // Updating the presentation list never creates positions or saves geometry.
      untracked(() => this.spaces.update((spaces) => spaces.map((space) => ({
        ...space,
        devices: remoteDevices
          .filter((device) => device.assignment.spaceId === space.id)
          .map((device) => {
            const prior = space.devices.find((old) => old.id === device.id);
            return { ...device, floorPlanPosition: prior?.floorPlanPosition ?? device.floorPlanPosition };
          }),
      }))));
    });
  }

  selectRegistrationCategory(category: DeviceCapabilityCategory): void {
    this.deviceCategory.set(category);
    this.existingDeviceId = '';
    this.deviceFormError.set('');
    if (category === 'DISPLAY') {
      this.newDeviceVariable = 'LOCAL_STATUS_DISPLAY';
      this.newDeviceUnit = '';
    } else if (category === 'ACTUATOR') {
      this.newDeviceVariable = 'AUDIBLE_ALARM';
      this.newDeviceUnit = '';
    } else {
      this.newDeviceVariable = 'TEMPERATURE';
      this.newDeviceUnit = 'C';
    }
  }

  updateSensorVariable(value: string): void {
    this.newDeviceVariable = value;
    const units: Record<string, string> = {
      TEMPERATURE: 'C', GAS_PPM: 'ppm', SMOKE_PPM: 'ppm',
      HUMIDITY: '%', MOTION: 'events',
    };
    this.newDeviceUnit = units[value] ?? this.newDeviceUnit;
    this.deviceFormError.set('');
  }

  openDeviceManager(): void {
    const zones = this.registrationZones();
    const selected = this.selectedArea()?.spaceId;
    this.creationSpaceId.set(zones.some(zone => zone.id === selected) ? selected! : zones[0]?.id ?? '');
    this.deviceDialogMode.set('new');
    this.deviceDialogOpen.set(true);
    this.deviceFormError.set('');
    this.existingDeviceId = '';
    this.selectRegistrationCategory(this.deviceCategory());
    this.deviceWorkspace.loadFleet().subscribe({
      error: () => this.deviceFormError.set('No se pudo cargar el catálogo de dispositivos existentes.'),
    });
  }

  saveDeviceDialog(): void {
    if (this.deviceDialogBusy()) return;
    this.deviceFormError.set('');
    const zoneId = this.creationSpaceId();
    const building = this.building();
    // An area can be unlinked, but a registered device must reference a real zone.
    // Do not filter these zones by Normal/Warning/Critical monitoring status.
    if (!building || !this.registrationZones().some(zone => zone.id === zoneId)) {
      this.deviceFormError.set('Selecciona cualquier zona real de este piso. Si aún no existe, créala en Áreas.');
      return;
    }
    if (this.deviceDialogMode() === 'existing') {
      const candidate = this.existingDeviceCandidates().find(row => row.catalog.id === this.existingDeviceId);
      if (!candidate || candidate.catalog.assignment.zoneId !== zoneId) {
        this.deviceFormError.set('Selecciona un dispositivo existente de la zona elegida y de la categoría correcta.');
        return;
      }
      this.placeDeviceInitial(candidate.catalog.id);
      this.deviceDialogOpen.set(false);
      return;
    }

    const category = this.deviceCategory();
    const name = this.newDeviceName.trim();
    const code = this.newDeviceCode.trim();
    const variable = this.newDeviceVariable.trim().toUpperCase();
    const capabilityCode = category === 'DISPLAY' ? 'LOCAL_STATUS_DISPLAY' : variable;
    const unit = this.newDeviceUnit.trim();
    if (!name) { this.deviceFormError.set('Ingresa el nombre del dispositivo.'); return; }
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      this.deviceFormError.set('El código solo admite letras ASCII, números, guiones y guiones bajos. Ejemplo: GAS_SENSOR_A.');
      return;
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(capabilityCode)) {
      this.deviceFormError.set('Selecciona un código de capacidad válido.');
      return;
    }
    if (category === 'SENSOR' && !unit) {
      this.deviceFormError.set('Indica la unidad de la medición.');
      return;
    }
    if (category === 'ACTUATOR' && !this.actuatorCapabilities.some(item => item.code === capabilityCode)) {
      this.deviceFormError.set('Selecciona una capacidad de actuación válida.');
      return;
    }

    this.deviceDialogBusy.set(true);
    this.deviceWorkspace.registerDevice({
      deviceCode: code,
      name,
      specifications: {},
      assignment: { buildingId: building.id, zoneId },
      capabilities: [{
        code: capabilityCode,
        kind: category === 'SENSOR' ? 'MEASUREMENT' : 'ACTUATION',
        unit: category === 'SENSOR' ? unit : undefined,
      }],
    }).subscribe({
      next: (registered) => this.deviceWorkspace.loadFleet().subscribe({
        next: (rows) => {
          this.deviceDialogBusy.set(false);
          const createdId = registered.device.id;
          if (rows.some(row => row.catalog.id === createdId)) {
            this.placeDeviceInitial(createdId);
            this.deviceDialogOpen.set(false);
            this.newDeviceName = '';
            this.newDeviceCode = '';
          } else {
            this.deviceFormError.set('Registrado en el servidor, pero no se pudo actualizar la lista. Recarga antes de intentar otra vez.');
          }
        },
        error: () => {
          this.deviceDialogBusy.set(false);
          this.deviceFormError.set('Dispositivo registrado; no se pudo actualizar la lista. Recarga antes de volver a registrarlo.');
        },
      }),
      error: (error: { message?: string }) => {
        this.deviceDialogBusy.set(false);
        this.deviceFormError.set(error.message ?? 'No se pudo registrar el dispositivo.');
      },
    });
  }

  private placeDeviceInitial(deviceId: string): void {
    const device = this.store.devices().find((item) => item.id === deviceId);
    const zone = this.registrationZones().find((item) => item.id === device?.spaceId);
    if (!device || !zone) {
      this.snackBar.open('Dispositivo sin zona en este piso. Comprueba su asignación en Dispositivos.', 'Cerrar', { duration: 4500 });
      return;
    }
    // The projection effect may not have run yet after loadFleet(). Attach it immediately.
    this.spaces.update(spaces => spaces.map(space => space.id === zone.id
      ? { ...space, devices: [...space.devices.filter(item => item.id !== deviceId), device] }
      : space));
    const area = this.areas().find((item) => item.spaceId === zone.id);
    if (area) {
      const point = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
      this.moveDeviceLocally(device.id, zone.id, point);
      this.store.updateDevicePosition(this.building()!.id, this.floor()!.id, zone.id, device.id, point);
      this.hasUnsavedChanges.set(true);
      this.snackBar.open('Dispositivo registrado. Guarda el plano para sincronizar su posición.', 'Cerrar', { duration: 4000 });
    } else {
      this.snackBar.open('Dispositivo registrado. Haz clic en un área, pasadizo, baño o cualquier punto del plano para colocarlo.', 'Cerrar', { duration: 6000 });
    }
    this.leftPanel.set('devices');
    this.selectDevice(device.id);
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) =>
      this.loadFloor(params.get('buildingId') ?? '', params.get('floorId') ?? ''),
    );
  }

  private loadFloor(buildingId: string, floorId: string): void {
    const restoreKey = `${buildingId}:${floorId}`;
    if (!this.restoredFloorKeys.has(restoreKey)) {
      this.restoredFloorKeys.add(restoreKey);
      this.planSyncStatus.set('LOADING');
      this.planHydration.hydrate(this.store, buildingId, floorId).subscribe(result => {
        if (result.error && result.source === 'EMPTY') {
          this.planSyncStatus.set('ERROR');
          this.snackBar.open(result.error.message || 'The server plan could not be loaded.', 'Close', { duration: 4500 });
        } else {
          this.planSyncStatus.set(result.source === 'REMOTE' ? 'SYNCED' : result.source === 'EMPTY' ? 'EMPTY' : 'LOCAL_ONLY');
        }
        if (!this.hasUnsavedChanges()) this.loadFloor(buildingId, floorId);
      });
    }
    const building = this.store.getBuilding(buildingId);
    const floor = this.store.getFloor(buildingId, floorId);
    this.building.set(building);
    this.floor.set(floor);
    this.selection.set(undefined);
    this.selectedTool.set('Select');
    this.undoStack = [];
    this.redoStack = [];
    this.updateHistoryState();
    this.hasUnsavedChanges.set(false);
    if (!floor) {
      this.spaces.set([]);
      this.elements.set([]);
      this.planImageUrl.set(undefined);
      return;
    }
    const storedDevices = this.store.devices();
    const spaces = structuredClone(floor.spaces).map((space) => {
      const nestedById = new Map(space.devices.map((device) => [device.id, device]));
      const assigned = storedDevices
        .filter((device) => device.spaceId === space.id)
        .map((device) => ({ ...device, ...nestedById.get(device.id) }));
      const assignedIds = new Set(assigned.map((device) => device.id));
      return {
        ...space,
        devices: [...assigned, ...space.devices.filter((device) => !assignedIds.has(device.id))],
      };
    });
    const elements = structuredClone(floor.planElements ?? []);
    const linked = new Set(
      elements.filter((element) => element.type === 'Space').map((element) => element.spaceId),
    );
    for (const space of spaces.filter((item) => item.polygon.length >= 3 && !linked.has(item.id))) {
      const box = this.bounds(space.polygon);
      elements.push({
        id: this.uniqueId('plan-area'),
        type: 'Space',
        spaceId: space.id,
        label: space.name,
        ...box,
      });
    }
    this.spaces.set(spaces);
    this.elements.set(elements);
    this.planImageUrl.set(floor.planImageUrl);
    const first = elements.find((element) => element.type === 'Space');
    if (first) this.selectArea(first.id, false);
    this.propertiesOpen.set(false);
  }

  requestFloorSwitch(floorId: string): void {
    if (!floorId || floorId === this.floor()?.id) return;
    if (this.hasUnsavedChanges()) {
      this.pendingFloorId.set(floorId);
      return;
    }
    this.navigateToFloor(floorId);
  }

  cancelFloorSwitch(): void {
    this.pendingFloorId.set(undefined);
  }

  saveAndSwitchFloor(): void {
    this.save();
  }

  private navigateToFloor(floorId: string): void {
    const buildingId = this.building()?.id;
    if (buildingId)
      void this.router.navigate(['/buildings', buildingId, 'floors', floorId, 'editor']);
  }

  selectTool(tool: EditorTool): void {
    if (tool === 'Device')
      this.creationSpaceId.set(
        this.selectedArea()?.spaceId ??
          this.areas().find((area) => area.id === this.deviceTargetAreaId)?.spaceId ??
          this.spaces()[0]?.id ??
          '',
      );
    this.selectedTool.set(tool);
    if (tool !== 'Select') this.selection.set(undefined);
    if (tool === 'Device') {
      this.spaces().forEach((space) => {
        if (!this.store.spaces().some((item) => item.id === space.id))
          this.store.addSpace(space.buildingId, space.floorId, space);
      });
      this.propertiesOpen.set(true);
    }
  }
  selectArea(areaId: string, open = true): void {
    const area = this.areas().find((item) => item.id === areaId);
    if (!area) return;
    this.selection.set({ kind: 'area', id: area.id });
    this.deviceTargetAreaId = area.id;
    this.selectedTool.set('Select');
    this.loadAreaProperties(area);
    this.propertiesOpen.set(open);
  }
  selectUnassignedSpace(spaceId: string): void {
    this.linkedSpaceId.set(spaceId);
    this.selectedTool.set('Area');
  }
  selectDevice(deviceId: string, open = true): void {
    const device = this.floorDevices().find((item) => item.id === deviceId);
    if (!device) return;
    this.selection.set({ kind: 'device', id: device.id });
    this.selectedTool.set(device.floorPlanPosition ? 'Select' : 'Device');
    this.propertiesOpen.set(open);
  }
  closeProperties(): void {
    this.propertiesOpen.set(false);
  }
  readonly deviceDefinition = deviceDefinition;
  private readonly indexedDevices = computed(
    () => new Map(this.store.devices().map((device) => [device.id, device])),
  );
  devicesForSpace(space: Space): Device[] {
    const current = this.indexedDevices();
    return space.devices
      .filter((device) => current.has(device.id))
      .map((device) => ({
        ...current.get(device.id)!,
        spaceId: space.id,
        floorPlanPosition: device.floorPlanPosition,
      }));
  }
  deviceSaved(device: Device): void {
    this.spaces.update((spaces) =>
      spaces.map((space) => ({
        ...space,
        devices:
          space.id === device.spaceId
            ? [...space.devices.filter((item) => item.id !== device.id), device]
            : space.devices.filter((item) => item.id !== device.id),
      })),
    );
    this.leftPanel.set('devices');
    this.deviceCategory.set(device.capabilities.length
      ? capabilityCategory(device.capabilities[0])
      : deviceDefinition(device.type).category);
    this.selectDevice(device.id);
  }
  deviceRemoved(id: string): void {
    const device = this.store.devices().find((item) => item.id === id);
    if (device) this.replaceLocalDevice(device);
    else {
      this.spaces.update((spaces) =>
        spaces.map((space) => ({
          ...space,
          devices: space.devices.filter((item) => item.id !== id),
        })),
      );
      this.selection.set(undefined);
      this.closeProperties();
    }
  }
  checkpointDeviceChange(): void {
    this.checkpoint();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.imageError.set(undefined);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.imageError.set('Use a JPG, PNG or WEBP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.imageError.set('For reliable browser storage, the floor plan image must be smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.checkpoint();
        this.planImageUrl.set(reader.result);
      }
    };
    reader.onerror = () => this.imageError.set('The selected image could not be loaded.');
    reader.readAsDataURL(file);
  }
  removeImage(): void {
    if (this.planImageUrl()) {
      this.checkpoint();
      this.planImageUrl.set(undefined);
    }
  }

  pointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const point = this.eventPoint(event);
    const tool = this.selectedTool();
    if (tool === 'Device') {
      if (this.selectedDevice()) this.placeSelectedDevice(point);
      return;
    }
    if (tool === 'Select') {
      this.selection.set(undefined);
      return;
    }
    if (tool === 'Pan')
      this.drag = {
        mode: 'pan',
        start: { x: event.clientX, y: event.clientY },
        current: point,
        originalView: this.viewOrigin(),
      };
    else {
      this.drag = { mode: 'draw', start: point, current: point };
      this.draft.set({ x: point.x, y: point.y, width: 0, height: 0 });
    }
    this.canvas?.nativeElement.setPointerCapture(event.pointerId);
  }
  pointerMove(event: PointerEvent): void {
    if (!this.drag) return;
    if (this.drag.mode === 'pan') {
      const scale = 1 / (this.canvas?.nativeElement.getScreenCTM()?.a || 1);
      this.viewOrigin.set({
        x: (this.drag.originalView?.x ?? 0) - (event.clientX - this.drag.start.x) * scale,
        y: (this.drag.originalView?.y ?? 0) - (event.clientY - this.drag.start.y) * scale,
      });
      return;
    }
    const point = this.eventPoint(event);
    this.drag.current = point;
    if (this.drag.mode === 'draw') this.draft.set(this.rectFromPoints(this.drag.start, point));
    else if (this.drag.mode === 'device') {
      if (!this.drag.deviceMoved) {
        this.checkpoint();
        this.drag.deviceMoved = true;
      }
      this.moveDeviceLocally(this.drag.selection!.id, this.drag.originalDevice!.spaceId, point);
    } else if (this.drag.mode === 'move') {
      if (point.x === this.drag.start.x && point.y === this.drag.start.y) return;
      if (!this.drag.deviceMoved) {
        this.checkpoint();
        this.drag.deviceMoved = true;
      }
      this.transformSelection(this.drag, point, false);
    } else this.transformSelection(this.drag, point, true);
  }
  pointerUp(event: PointerEvent): void {
    if (!this.drag) return;
    if (this.drag.mode === 'draw') this.finishDrawing();
    else if (this.drag.mode === 'device' && this.drag.deviceMoved) this.finishDeviceDrag(this.drag);
    else if (this.drag.invalidPlacement) this.showOverlapWarning();
    const clicked =
      Math.hypot(this.drag.current.x - this.drag.start.x, this.drag.current.y - this.drag.start.y) <
      3;
    if (clicked && (this.drag.mode === 'device' || this.drag.mode === 'move'))
      this.propertiesOpen.set(true);
    if (!this.drag.invalidPlacement && (this.drag.mode === 'move' || this.drag.mode === 'resize'))
      this.store.updateDevices(this.floorDevices());
    this.drag = undefined;
    this.draft.set(undefined);
    if (this.canvas?.nativeElement.hasPointerCapture(event.pointerId))
      this.canvas.nativeElement.releasePointerCapture(event.pointerId);
  }
  beginMove(event: PointerEvent, kind: Selection['kind'], id: string): void {
    if (this.selectedTool() !== 'Select') return;
    event.stopPropagation();
    const selected = { kind, id } as Selection;
    this.selection.set(selected);
    if (kind === 'area') this.loadAreaProperties(this.areas().find((area) => area.id === id)!);
    const point = this.eventPoint(event);
    const originalElement = this.elements().find((element) => element.id === id);
    this.drag = {
      mode: 'move',
      start: point,
      current: point,
      selection: selected,
      originalElement: structuredClone(originalElement),
      originalSpace:
        kind === 'area' && originalElement
          ? structuredClone(this.areaSpace(originalElement))
          : undefined,
    };
    this.canvas?.nativeElement.setPointerCapture(event.pointerId);
  }
  beginResize(event: PointerEvent): void {
    const selected = this.selection();
    if (!selected) return;
    event.stopPropagation();
    const point = this.eventPoint(event);
    this.checkpoint();
    const originalElement = this.elements().find((element) => element.id === selected.id);
    this.drag = {
      mode: 'resize',
      start: point,
      current: point,
      selection: selected,
      originalElement: structuredClone(originalElement),
      originalSpace:
        selected.kind === 'area' && originalElement
          ? structuredClone(this.areaSpace(originalElement))
          : undefined,
    };
    this.canvas?.nativeElement.setPointerCapture(event.pointerId);
  }

  beginDeviceDrag(event: PointerEvent, deviceId: string): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    const device = this.floorDevices().find((item) => item.id === deviceId);
    if (!device) return;
    this.selectDevice(device.id, false);
    this.selectedTool.set('Select');
    const point = this.eventPoint(event);
    this.drag = {
      mode: 'device',
      start: point,
      current: point,
      selection: { kind: 'device', id: device.id },
      originalDevice: structuredClone(device),
      deviceMoved: false,
      dirtyBefore: this.hasUnsavedChanges(),
    };
    this.canvas?.nativeElement.setPointerCapture(event.pointerId);
  }

  applyAreaChanges(): void {
    const area = this.selectedArea();
    if (!area || !this.areaName().trim()) return;
    const targetId = this.linkedSpaceId();
    const other = targetId
      ? this.areas().find((item) => item.id !== area.id && item.spaceId === targetId)
      : undefined;
    if (other) {
      this.assignmentConflict.set({
        areaId: area.id,
        targetSpaceId: targetId,
        otherAreaId: other.id,
      });
      return;
    }
    this.applyArea(area, targetId || undefined);
  }
  resolveConflict(action: 'cancel' | 'replace' | 'new'): void {
    const conflict = this.assignmentConflict();
    if (!conflict) return;
    this.assignmentConflict.set(undefined);
    const area = this.areas().find((item) => item.id === conflict.areaId);
    if (!area) return;
    if (action === 'cancel') {
      this.linkedSpaceId.set(area.spaceId ?? '');
      return;
    }
    if (action === 'new') {
      this.applyArea(area, undefined, true);
      return;
    }
    const other = this.areas().find((item) => item.id === conflict.otherAreaId);
    const target = this.spaces().find((space) => space.id === conflict.targetSpaceId);
    if (other && target) {
      this.elements.update((elements) =>
        elements.map((item) =>
          item.id === other.id
            ? { ...item, spaceId: undefined, label: `${target.name} (sin zona monitoreada)` }
            : item,
        ),
      );
    }
    this.applyArea(area, conflict.targetSpaceId);
  }

  requestDeleteArea(): void {
    const area = this.selectedArea();
    if (area) this.deleteCandidate.set(area);
  }
  deleteAreaOnly(): void {
    const area = this.deleteCandidate();
    if (!area) return;
    this.checkpoint();
    this.elements.update((elements) => elements.filter((item) => item.id !== area.id));
    if (area.spaceId)
      this.spaces.update((spaces) =>
        spaces.map((space) =>
          space.id === area.spaceId
            ? {
                ...space,
                polygon: [],
                devices: space.devices.map((device) => ({
                  ...device,
                  // Removing an area must not erase devices positioned in a hallway or bathroom.
                  floorPlanPosition: isPointInsideVisualArea(device.floorPlanPosition, area)
                    ? undefined : device.floorPlanPosition,
                })),
              }
            : space,
        ),
      );
    this.store.updateDevices(this.floorDevices());
    this.deleteCandidate.set(undefined);
    this.selection.set(undefined);
  }
  deleteAreaAndSpace(): void {
    const area = this.deleteCandidate();
    if (!area) return;
    this.checkpoint();
    this.elements.update((elements) => elements.filter((item) => item.id !== area.id));
    if (area.spaceId) {
      this.spaces.update((spaces) => spaces.map(space =>
        space.id === area.spaceId ? { ...space, polygon: [] } : space));
    }
    this.deleteCandidate.set(undefined);
    this.selection.set(undefined);
  }
  deleteStructuralElement(): void {
    const element = this.selectedElement();
    if (!element) return;
    this.checkpoint();
    this.elements.update((elements) => elements.filter((item) => item.id !== element.id));
    this.selection.set(undefined);
  }

  updateAreaGeometry(property: 'x' | 'y' | 'width' | 'height', raw: string): void {
    const area = this.selectedArea();
    const value = this.snap(Number(raw));
    if (!area || !Number.isFinite(value)) return;
    const updated = {
      ...area,
      [property]: property === 'width' || property === 'height' ? Math.max(10, value) : value,
    };
    if (this.overlapsAnotherArea(updated, area.id)) {
      this.showOverlapWarning();
      return;
    }
    this.checkpoint();
    this.replaceElement(updated);
    this.syncSpaceGeometry(area, updated);
  }
  updateElementNumber(property: 'x' | 'y' | 'width' | 'height' | 'rotation', raw: string): void {
    const element = this.selectedElement();
    const value = Number(raw);
    if (!element || !Number.isFinite(value)) return;
    this.checkpoint();
    this.replaceElement({ ...element, [property]: value });
  }
  updateElementLabel(label: string): void {
    const element = this.selectedElement();
    if (element) {
      this.checkpoint();
      this.replaceElement({ ...element, label });
    }
  }

  zoomIn(): void {
    this.zoom.update((value) => Math.min(3, Number((value + 0.25).toFixed(2))));
  }
  zoomOut(): void {
    this.zoom.update((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))));
  }
  fit(): void {
    this.zoom.set(1);
    this.viewOrigin.set({ x: 0, y: 0 });
  }
  resetView(): void {
    this.fit();
    this.selection.set(undefined);
  }
  undo(): void {
    const state = this.undoStack.pop();
    if (!state) return;
    this.redoStack.push(this.snapshot());
    this.restore(state);
    this.updateHistoryState();
  }
  redo(): void {
    const state = this.redoStack.pop();
    if (!state) return;
    this.undoStack.push(this.snapshot());
    this.restore(state);
    this.updateHistoryState();
  }
  clearPlan(): void {
    if (
      !window.confirm(
        'Clear Floor Plan?\n\nThis will remove all visual elements and device positions from this floor.',
      )
    )
      return;
    const removeImage = this.planImageUrl()
      ? window.confirm('Also remove the uploaded background image?')
      : false;
    this.checkpoint();
    this.spaces.update((spaces) =>
      spaces.map((space) => ({
        ...space,
        polygon: [],
        devices: space.devices.map((device) => ({ ...device, floorPlanPosition: undefined })),
      })),
    );
    this.elements.set([]);
    if (removeImage) this.planImageUrl.set(undefined);
    this.selection.set(undefined);
  }

  save(): void {
    const building = this.building();
    const floor = this.floor();
    if (!building || !floor) return;
    const spaces = this.spaces().map((space) => ({
      ...space,
      devices: this.devicesForSpace(space),
    }));
    const state = this.localPlans.capture(
      building.id, floor.name, this.planImageUrl(), this.elements(), spaces);
    const result = this.localPlans.saveState(state);
    if (result.ok) {
      this.store.updateFloor(building.id, {
        ...floor,
        spaces: structuredClone(spaces),
        planImageUrl: this.planImageUrl(),
        planElements: structuredClone(this.elements()),
        planConfigured: Boolean(
          this.planImageUrl() ||
          this.elements().length ||
          spaces.some((space) => space.polygon.length >= 3),
        ),
      });
      for (const space of spaces) {
        for (const device of space.devices) {
          if (device.spaceId === space.id && device.floorPlanPosition) {
            this.store.updateDevicePosition(
              building.id,
              floor.id,
              space.id,
              device.id,
              device.floorPlanPosition,
            );
          }
        }
      }
      this.hasUnsavedChanges.set(false);
      this.planSyncStatus.set('SYNCING');
      this.remotePlans.save(state).subscribe({
        next: () => {
          this.planSyncStatus.set('SYNCED');
          this.finishSaveNavigation();
          this.snackBar.open('Plan synchronized with the server.', 'Close', {
            duration: 3000, horizontalPosition: 'right', verticalPosition: 'top',
          });
        },
        error: () => {
          this.planSyncStatus.set('ERROR');
          this.finishSaveNavigation();
          this.snackBar.open('Server sync failed; the plan remains saved in this browser.', 'Close', {
            duration: 5000, horizontalPosition: 'right', verticalPosition: 'top',
          });
        },
      });
    }
    if (!result.ok) this.snackBar.open(result.message, 'Close', {
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }

  private finishSaveNavigation(): void {
    const pending = this.pendingFloorId();
    this.pendingFloorId.set(undefined);
    if (pending) this.navigateToFloor(pending);
  }

  areaSpace(area: FloorPlanElement): Space | undefined {
    return area.spaceId ? this.spaces().find((space) => space.id === area.spaceId) : undefined;
  }
  isAreaConfigured(area: FloorPlanElement): boolean {
    const space = this.areaSpace(area);
    return !!space && !/^Area \d+$/.test(space.name);
  }
  areaNameFor(area: FloorPlanElement): string {
    return this.areaSpace(area)?.name ?? area.label ?? 'Unconfigured Area';
  }
  areaRoomFor(area: FloorPlanElement): string {
    return this.areaSpace(area)?.roomNumber ?? '';
  }
  conflictSpaceName(conflict: AssignmentConflict): string {
    const area = this.areas().find((item) => item.id === conflict.otherAreaId);
    return area ? this.areaNameFor(area) : 'This space';
  }
  pointsForArea(area: FloorPlanElement): string {
    return this.points(this.rectPolygon(area));
  }
  points(points: FloorPlanPoint[]): string {
    return points.map((point) => `${point.x},${point.y}`).join(' ');
  }
  deviceCategoryFor(device: Device): DeviceCapabilityCategory {
    return deviceDefinition(device.type).category;
  }
  deviceLetter(device: Device): string {
    return (
      {
        Temperature: 'T',
        Smoke: 'S',
        Gas: 'G',
        Humidity: 'H',
        Motion: 'M',
        HVAC: 'HV',
        AudibleAlarm: 'AL',
        VisualSignal: 'LED',
        Servomotor: 'SV',
        OLED: 'D',
      } as Record<DeviceType, string>
    )[device.type];
  }
  deviceStatus(device: Device): string {
    return device.status.toLowerCase();
  }
  devicePosition(devices: Device[], index: number): FloorPlanPoint | undefined {
    return visualDevicePosition(devices, index);
  }
  deviceLabel(device: Device): string {
    return device.displayName || device.name;
  }
  assignedSpaceLabel(device: Device): string {
    const space = this.spaces().find((item) => item.id === device.spaceId);
    return space ? `${space.name} ${space.roomNumber ?? ''}`.trim() : 'Unassigned';
  }
  elementLabel(element: FloorPlanElement): string {
    return element.label ?? element.type;
  }
  isStairArea(area: FloorPlanElement): boolean {
    return this.areaSpace(area)?.type === 'Stairs';
  }
  bounds(points: FloorPlanPoint[]): { x: number; y: number; width: number; height: number } {
    if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }

  private finishDrawing(): void {
    const rect = this.draft();
    if (!rect || rect.width < 10 || rect.height < 10) return;
    const tool = this.selectedTool();
    if (tool === 'Area') {
      if (this.overlapsAnotherArea(rect)) {
        this.showOverlapWarning();
        return;
      }
      this.checkpoint();
      const number = this.nextAreaNumber();
      const areaId = this.uniqueId('plan-area');
      const targetId = tool === 'Area' ? this.linkedSpaceId() : '';
      const target = targetId
        ? this.spaces().find(
            (space) =>
              space.id === targetId && !this.areas().some((area) => area.spaceId === targetId),
          )
        : undefined;
      if (target) {
        const space = { ...target, polygon: this.rectPolygon(rect) };
        this.spaces.update((spaces) =>
          spaces.map((item) => (item.id === target.id ? space : item)),
        );
      }
      const area: FloorPlanElement = {
        id: areaId,
        type: 'Space',
        spaceId: target?.id,
        label: target?.name ?? `Area ${number}`,
        ...rect,
      };
      this.elements.update((elements) => [...elements, area]);
      this.selection.set({ kind: 'area', id: area.id });
      this.loadAreaProperties(area);
      this.selectedTool.set('Select');
      return;
    }
    this.checkpoint();
    const type = tool as FloorPlanElementType;
    const thin = type === 'Wall' || type === 'Door';
    const element: FloorPlanElement = {
      id: this.uniqueId(type.toLowerCase()),
      type,
      ...rect,
      height: thin ? Math.max(5, Math.min(rect.height, 10)) : rect.height,
      label: type === 'Restroom' ? 'WC' : type,
    };
    this.elements.update((elements) => [...elements, element]);
    this.selection.set({ kind: 'element', id: element.id });
    this.selectedTool.set('Select');
  }

  private applyArea(area: FloorPlanElement, targetSpaceId?: string, forceNew = false): void {
    const target = !forceNew && targetSpaceId
      ? this.spaces().find((space) => space.id === targetSpaceId)
      : undefined;
    const building = this.building();
    const floor = this.floor();
    if (!building || !floor) return;
    const operation = this.buildingWorkspace.loadBuilding(building.id).pipe(
      switchMap(() => target
        ? this.buildingWorkspace.updateZone(target.id, {
            name: this.areaName().trim(),
            description: target.roomNumber ? `Room ${target.roomNumber}` : undefined,
            floorLabel: floor.name,
          })
        : this.buildingWorkspace.addZone({
            zoneCode: this.zoneCode(this.areaRoomNumber().trim() || this.areaName()),
            name: this.areaName().trim(),
            description: this.areaRoomNumber().trim() ? `Room ${this.areaRoomNumber().trim()}` : undefined,
            floorLabel: floor.name,
          })),
    );
    operation.subscribe({
      next: result => {
        const persisted = target
          ? result.building.zones.find(zone => zone.id === target.id)
          : [...result.building.zones].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .find(zone => zone.name === this.areaName().trim() && zone.floorLabel === floor.name);
        if (!persisted) {
          this.snackBar.open('The zone was saved but could not be associated with the visual area. Reload and try again.', 'Close', { duration: 5000 });
          return;
        }
        this.checkpoint();
        const realSpace: Space = target
          ? target
          : {
              id: persisted.id,
              buildingId: persisted.buildingId,
              floorId: floor.id,
              name: persisted.name,
              roomNumber: persisted.zoneCode,
              type: this.areaType(),
              sensitivity: this.areaSensitivity(),
              configurationPersisted: false,
              status: 'Normal',
              hasLiveData: false,
              thresholds: this.thresholdsFor(this.areaType()),
              polygon: [],
              devices: [],
            };
        this.attachAreaToSpace(area, realSpace);
      },
      error: (error: { message?: string; status?: number }) => this.snackBar.open(
        error.status === 409 ? 'The building changed. Reload and retry the zone operation.' : error.message ?? 'The zone could not be saved.',
        'Close', { duration: 5000 }),
    });
  }

  private attachAreaToSpace(area: FloorPlanElement, target: Space): void {
    const previousId = area.spaceId;
    const updatedSpace: Space = {
      ...target,
      name: this.areaName().trim(),
      roomNumber: this.areaRoomNumber().trim() || undefined,
      type: this.areaType(),
      sensitivity: this.areaSensitivity(),
      thresholds: target.thresholds ?? this.thresholdsFor(this.areaType()),
      configurationPersisted: true,
      polygon: this.rectPolygon(area),
    };
    this.spaces.update((spaces) => {
      let next = spaces.map((space) => (space.id === updatedSpace.id ? updatedSpace : space));
      if (!spaces.some((space) => space.id === updatedSpace.id)) next = [...next, updatedSpace];
      if (previousId && previousId !== updatedSpace.id)
        next = next.map((space) => (space.id === previousId ? { ...space, polygon: [] } : space));
      return next;
    });
    this.replaceElement({ ...area, spaceId: updatedSpace.id, label: updatedSpace.name });
    this.linkedSpaceId.set(updatedSpace.id);
  }
  private zoneCode(value: string): string {
    const base = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 42) || 'ZONE';
    return `${base}_${Date.now().toString(36).toUpperCase()}`.slice(0, 64);
  }
  private loadAreaProperties(area: FloorPlanElement): void {
    const space = this.areaSpace(area);
    this.areaName.set(space?.name ?? area.label ?? '');
    this.areaRoomNumber.set(space?.roomNumber ?? '');
    this.areaType.set(space?.type ?? 'Office');
    this.areaSensitivity.set(space?.sensitivity ?? 'Normal');
    this.linkedSpaceId.set(space?.id ?? '');
  }
  private transformSelection(drag: DragState, point: FloorPlanPoint, resize: boolean): void {
    const original = drag.originalElement;
    if (!original) return;
    const updated = resize
      ? {
          ...original,
          width: Math.max(10, this.snap(point.x) - original.x),
          height: Math.max(10, this.snap(point.y) - original.y),
        }
      : {
          ...original,
          x: original.x + this.snap(point.x - drag.start.x),
          y: original.y + this.snap(point.y - drag.start.y),
        };
    if (updated.type === 'Space' && this.overlapsAnotherArea(updated, updated.id)) {
      drag.invalidPlacement = true;
      return;
    }
    drag.invalidPlacement = false;
    this.replaceElement(updated);
    if (updated.type === 'Space') this.syncSpaceGeometry(original, updated, drag.originalSpace);
  }
  private syncSpaceGeometry(
    previous: FloorPlanElement,
    updated: FloorPlanElement,
    originalSpace?: Space,
  ): void {
    if (!updated.spaceId) return;
    this.spaces.update((spaces) =>
      spaces.map((space) => {
        if (space.id !== updated.spaceId) return space;
        const source = originalSpace?.id === space.id ? originalSpace : space;
        const devices = source.devices.map((device) => {
          const position = device.floorPlanPosition;
          // Devices placed elsewhere on the floor are not attached to this visual room.
          if (!position || !isPointInsideVisualArea(position, previous)) return device;
          const relativeX = previous.width > 0 ? (position.x - previous.x) / previous.width : 0.5;
          const relativeY = previous.height > 0 ? (position.y - previous.y) / previous.height : 0.5;
          const safeX = Math.min(0.98, Math.max(0.02, relativeX));
          const safeY = Math.min(0.98, Math.max(0.02, relativeY));
          return {
            ...device,
            floorPlanPosition: {
              x: updated.x + safeX * updated.width,
              y: updated.y + safeY * updated.height,
            },
          };
        });
        return { ...space, polygon: this.rectPolygon(updated), devices };
      }),
    );
  }
  private replaceElement(updated: FloorPlanElement): void {
    this.elements.update((elements) =>
      elements.map((element) => (element.id === updated.id ? updated : element)),
    );
  }
  private placeSelectedDevice(point: FloorPlanPoint): void {
    const device = this.selectedDevice();
    const placement = visualPlacementForAssignedZone(device, point, this.spaces());
    if (!placement) {
      this.snackBar.open('Selecciona un dispositivo con zona real y una posición dentro del plano.', 'Cerrar', {
        duration: 3500,
      });
      return;
    }
    // Physical coordinates are independent of the zone's drawn polygon and risk state.
    // This does NOT change the device's persisted zone assignment in Device Management.
    this.checkpoint();
    this.moveDeviceLocally(device!.id, placement.zoneId, placement.position);
    const building = this.building();
    const floor = this.floor();
    if (building && floor) this.store.updateDevicePosition(building.id, floor.id, placement.zoneId, device!.id, placement.position);
    this.selectedTool.set('Select');
    this.snackBar.open('Dispositivo ubicado. Guarda el plano para sincronizar la posición.', 'Cerrar', { duration: 3500 });
  }

  private finishDeviceDrag(drag: DragState): void {
    const original = drag.originalDevice;
    if (!original) return;
    const placement = visualPlacementForAssignedZone(original, drag.current, this.spaces());
    if (!placement) {
      this.moveDeviceLocally(original.id, original.spaceId, original.floorPlanPosition);
      this.undoStack.pop();
      this.hasUnsavedChanges.set(drag.dirtyBefore ?? false);
      this.updateHistoryState();
      this.snackBar.open('Suelta el dispositivo dentro del lienzo del piso.', 'Cerrar', {
        duration: 3500,
      });
      return;
    }
    this.moveDeviceLocally(original.id, placement.zoneId, placement.position);
    const building = this.building();
    const floor = this.floor();
    if (building && floor) this.store.updateDevicePosition(building.id, floor.id, placement.zoneId, original.id, placement.position);
    this.selectDevice(original.id, false);
  }

  private moveDeviceLocally(
    deviceId: string,
    targetSpaceId: string,
    position?: FloorPlanPoint,
  ): void {
    const current = this.floorDevices().find((device) => device.id === deviceId);
    if (!current) return;
    // targetSpaceId is the device's real zone ID; visual placement never reassigns it.
    const updated = { ...current, floorPlanPosition: position };
    this.spaces.update((spaces) =>
      spaces.map((space) => ({
        ...space,
        devices:
          space.id === targetSpaceId
            ? [...space.devices.filter((device) => device.id !== deviceId), updated]
            : space.devices.filter((device) => device.id !== deviceId),
      })),
    );
  }

  private replaceLocalDevice(updated: Device): void {
    this.spaces.update((spaces) =>
      spaces.map((space) => ({
        ...space,
        devices: space.devices.map((device) => (device.id === updated.id ? updated : device)),
      })),
    );
  }

  private eventPoint(event: PointerEvent): FloorPlanPoint {
    const svg = this.canvas?.nativeElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: this.snap(point.x), y: this.snap(point.y) };
  }
  private rectFromPoints(a: FloorPlanPoint, b: FloorPlanPoint) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    };
  }
  private rectPolygon(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): FloorPlanPoint[] {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ];
  }
  private overlapsAnotherArea(
    candidate: { x: number; y: number; width: number; height: number },
    excludedId?: string,
  ): boolean {
    return this.areas().some(
      (area) =>
        area.id !== excludedId &&
        candidate.x < area.x + area.width &&
        candidate.x + candidate.width > area.x &&
        candidate.y < area.y + area.height &&
        candidate.y + candidate.height > area.y,
    );
  }
  private hasAreaOverlaps(): boolean {
    return this.areas().some((area, index, areas) =>
      areas
        .slice(index + 1)
        .some(
          (other) =>
            area.x < other.x + other.width &&
            area.x + area.width > other.x &&
            area.y < other.y + other.height &&
            area.y + area.height > other.y,
        ),
    );
  }
  private showOverlapWarning(): void {
    this.snackBar.open('Spaces cannot overlap. Choose an unoccupied area.', 'Close', {
      duration: 3200,
    });
  }
  private snap(value: number): number {
    return this.snapEnabled() ? Math.round(value / 25) * 25 : Math.round(value * 10) / 10;
  }
  private pointInPolygon(point: FloorPlanPoint, polygon: FloorPlanPoint[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      if (
        a.y > point.y !== b.y > point.y &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
      )
        inside = !inside;
    }
    return inside;
  }
  private nextAreaNumber(): number {
    const numbers = this.areas().map((area) =>
      Number((area.label ?? '').match(/^Area (\d+)$/)?.[1] ?? 0),
    );
    return Math.max(0, ...numbers) + 1;
  }
  private uniqueId(prefix: string): string {
    this.uniqueCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.uniqueCounter.toString(36)}`;
  }
  private checkpoint(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack = [];
    this.hasUnsavedChanges.set(true);
    this.updateHistoryState();
  }
  private snapshot(): EditorSnapshot {
    return {
      spaces: structuredClone(
        this.spaces().map((space) => ({ ...space, devices: this.devicesForSpace(space) })),
      ),
      elements: structuredClone(this.elements()),
      image: this.planImageUrl(),
      rules: structuredClone(this.store.rules()),
    };
  }
  private restore(state: EditorSnapshot): void {
    const current = new Map(this.store.devices().map((device) => [device.id, device]));
    this.spaces.set(
      structuredClone(state.spaces).map((space) => ({
        ...space,
        devices: space.devices.map((device) => ({
          ...(current.get(device.id) ?? device),
          spaceId: space.id,
          assignment: { ...device.assignment, spaceId: space.id, zoneId: space.id },
          floorPlanPosition: device.floorPlanPosition,
        })),
      })),
    );
    this.elements.set(structuredClone(state.elements));
    this.planImageUrl.set(state.image);
    this.selection.set(undefined);
    const building = this.building();
    const floor = this.floor();
    if (building && floor)
      this.store.syncFloorDevices(
        building.id,
        floor.id,
        this.spaces().flatMap((space) => space.devices),
      );
    const restoredIds = new Set(
      this.floorDevices()
        .filter((device) => !current.has(device.id))
        .map((device) => device.id),
    );
    const rules = structuredClone(this.store.rules());
    for (const rule of state.rules) {
      if (
        rule.sourceDeviceId &&
        restoredIds.has(rule.sourceDeviceId) &&
        !rules.some((item) => item.id === rule.id)
      )
        rules.push(rule);
      else {
        const existing = rules.find((item) => item.id === rule.id);
        if (existing?.targets)
          for (const target of rule.targets ?? []) {
            if (
              restoredIds.has(target.deviceId) &&
              !existing.targets.some(
                (item) =>
                  item.deviceId === target.deviceId &&
                  item.capabilityCode === target.capabilityCode,
              )
            )
              existing.targets.push(target);
          }
      }
    }
    this.store.setRules(rules);
    this.spaces().forEach((space) => this.response.reconcile(space.id));
  }
  private updateHistoryState(): void {
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }
  private thresholdsFor(type: SpaceType): SpaceThresholds {
    return defaultThresholds(type);
  }
}
