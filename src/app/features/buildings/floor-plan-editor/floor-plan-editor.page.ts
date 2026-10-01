import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Building, Device, DeviceStatus, DeviceType, Floor, FloorPlanElement, FloorPlanElementType, FloorPlanPoint, SensitivityLevel, Space, SpaceThresholds, SpaceType } from '../../../core/models/resq.models';
import { BuildingStoreService } from '../../../core/services/building-store.service';
import { visualDevicePosition } from '../../../shared/utils/floor-plan-device.utils';

type EditorTool = 'Select' | 'Area' | 'Hallway' | 'Wall' | 'Door' | 'Stairs' | 'Restroom' | 'Device' | 'Pan';
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
interface EditorSnapshot { spaces: Space[]; elements: FloorPlanElement[]; image?: string; }
interface AssignmentConflict { areaId: string; targetSpaceId: string; otherAreaId: string; }

@Component({
  selector: 'resq-floor-plan-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  templateUrl: './floor-plan-editor.page.html',
  styleUrls: ['./floor-plan-editor.page.scss', './floor-plan-editor.area.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloorPlanEditorPage implements OnInit {
  @ViewChild('canvas') private canvas?: ElementRef<SVGSVGElement>;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(BuildingStoreService);
  private readonly snackBar = inject(MatSnackBar);

  readonly building = signal<Building | undefined>(undefined);
  readonly floor = signal<Floor | undefined>(undefined);
  readonly spaces = signal<Space[]>([]);
  readonly elements = signal<FloorPlanElement[]>([]);
  readonly planImageUrl = signal<string | undefined>(undefined);
  readonly imageError = signal<string | undefined>(undefined);
  readonly selectedTool = signal<EditorTool>('Select');
  readonly selection = signal<Selection | undefined>(undefined);
  readonly draft = signal<{ x: number; y: number; width: number; height: number } | undefined>(undefined);
  readonly gridVisible = signal(true);
  readonly snapEnabled = signal(true);
  readonly zoom = signal(1);
  readonly viewOrigin = signal({ x: 0, y: 0 });
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  readonly assignmentConflict = signal<AssignmentConflict | undefined>(undefined);
  readonly deleteCandidate = signal<FloorPlanElement | undefined>(undefined);
  readonly hasUnsavedChanges = signal(false);
  readonly pendingFloorId = signal<string | undefined>(undefined);

  readonly areaName = signal('');
  readonly areaRoomNumber = signal('');
  readonly areaType = signal<SpaceType>('Office');
  readonly areaSensitivity = signal<SensitivityLevel>('Normal');
  readonly linkedSpaceId = signal('');
  readonly deviceDisplayName = signal('');
  readonly newDeviceDisplayName = signal('');
  readonly newDeviceName = signal('');
  readonly newDeviceCode = signal('');
  readonly newDeviceDescription = signal('');
  readonly newDeviceManufacturer = signal('');
  readonly newDeviceModel = signal('');
  readonly newDeviceSerialNumber = signal('');
  readonly newDeviceType = signal<DeviceType>('Temperature');
  readonly newDeviceStatus = signal<DeviceStatus>('Online');

  readonly spaceTypes: SpaceType[] = ['Laboratory', 'Classroom', 'Office', 'ServerRoom', 'Storage', 'Kitchen', 'Hallway', 'Stairs', 'Restroom', 'MeetingRoom', 'ControlRoom', 'Reception', 'Other'];
  readonly sensitivityLevels: SensitivityLevel[] = ['Low', 'Normal', 'High', 'Custom'];
  readonly deviceTypes: DeviceType[] = ['Temperature', 'Smoke', 'Gas', 'Humidity', 'Motion'];
  readonly deviceStatuses: DeviceStatus[] = ['Online', 'Warning', 'Critical', 'Offline'];
  readonly tools: Array<{ name: EditorTool; icon: string }> = [
    { name: 'Select', icon: 'near_me' }, { name: 'Area', icon: 'meeting_room' },
    { name: 'Hallway', icon: 'view_stream' }, { name: 'Wall', icon: 'horizontal_rule' },
    { name: 'Door', icon: 'door_front' }, { name: 'Stairs', icon: 'stairs' },
    { name: 'Restroom', icon: 'wc' }, { name: 'Device', icon: 'sensors' }, { name: 'Pan', icon: 'pan_tool' },
  ];

  readonly areas = computed(() => this.elements().filter(element => element.type === 'Space'));
  readonly selectedArea = computed(() => {
    const selected = this.selection();
    return selected?.kind === 'area' ? this.areas().find(area => area.id === selected.id) : undefined;
  });
  readonly selectedAreaSpace = computed(() => {
    const spaceId = this.selectedArea()?.spaceId;
    return spaceId ? this.spaces().find(space => space.id === spaceId) : undefined;
  });
  readonly selectedElement = computed(() => {
    const selected = this.selection();
    return selected?.kind === 'element' ? this.elements().find(element => element.id === selected.id) : undefined;
  });
  readonly floorDevices = computed(() => {
    const seen = new Set<string>();
    return this.spaces().flatMap(space => space.devices).filter(device => !seen.has(device.id) && !!seen.add(device.id));
  });
  readonly selectedDevice = computed(() => {
    const selected = this.selection();
    return selected?.kind === 'device' ? this.floorDevices().find(device => device.id === selected.id) : undefined;
  });
  readonly selectedDeviceSpace = computed(() => {
    const device = this.selectedDevice();
    return device ? this.spaces().find(space => space.id === device.spaceId) : undefined;
  });
  readonly unassignedSpaces = computed(() => {
    const assigned = new Set(this.areas().map(area => area.spaceId).filter(Boolean));
    return this.spaces().filter(space => !assigned.has(space.id));
  });
  readonly sortedFloors = computed(() => [...(this.building()?.floors ?? [])].sort((a, b) => a.level - b.level));
  readonly viewBox = computed(() => {
    const width = 1000 / this.zoom(); const height = 500 / this.zoom(); const origin = this.viewOrigin();
    return `${origin.x} ${origin.y} ${width} ${height}`;
  });

  private drag?: DragState;
  private undoStack: EditorSnapshot[] = [];
  private redoStack: EditorSnapshot[] = [];
  private uniqueCounter = 0;
  private deviceTargetAreaId?: string;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => this.loadFloor(
      params.get('buildingId') ?? '',
      params.get('floorId') ?? '',
    ));
  }

  private loadFloor(buildingId: string, floorId: string): void {
    const building = this.store.getBuilding(buildingId);
    const floor = this.store.getFloor(buildingId, floorId);
    this.building.set(building); this.floor.set(floor);
    this.selection.set(undefined); this.selectedTool.set('Select');
    this.undoStack = []; this.redoStack = []; this.updateHistoryState(); this.hasUnsavedChanges.set(false);
    if (!floor) { this.spaces.set([]); this.elements.set([]); this.planImageUrl.set(undefined); return; }
    const storedDevices = this.store.devices();
    const spaces = structuredClone(floor.spaces).map(space => {
      const nestedById = new Map(space.devices.map(device => [device.id, device]));
      const assigned = storedDevices
        .filter(device => device.spaceId === space.id)
        .map(device => ({ ...device, ...nestedById.get(device.id) }));
      const assignedIds = new Set(assigned.map(device => device.id));
      return { ...space, devices: [...assigned, ...space.devices.filter(device => !assignedIds.has(device.id))] };
    });
    const elements = structuredClone(floor.planElements ?? []);
    const linked = new Set(elements.filter(element => element.type === 'Space').map(element => element.spaceId));
    for (const space of spaces.filter(item => item.polygon.length >= 3 && !linked.has(item.id))) {
      const box = this.bounds(space.polygon);
      elements.push({ id: this.uniqueId('plan-area'), type: 'Space', spaceId: space.id, label: space.name, ...box });
    }
    this.spaces.set(spaces); this.elements.set(elements); this.planImageUrl.set(floor.planImageUrl);
    const first = elements.find(element => element.type === 'Space');
    if (first) this.selectArea(first.id);
  }

  requestFloorSwitch(floorId: string): void {
    if (!floorId || floorId === this.floor()?.id) return;
    if (this.hasUnsavedChanges()) { this.pendingFloorId.set(floorId); return; }
    this.navigateToFloor(floorId);
  }

  cancelFloorSwitch(): void { this.pendingFloorId.set(undefined); }

  saveAndSwitchFloor(): void {
    const floorId = this.pendingFloorId();
    if (!floorId) return;
    if (this.selectedArea() && this.areaName().trim()) this.applyAreaChanges();
    if (this.assignmentConflict()) return;
    this.save();
    this.pendingFloorId.set(undefined);
    this.navigateToFloor(floorId);
  }

  private navigateToFloor(floorId: string): void {
    const buildingId = this.building()?.id;
    if (buildingId) void this.router.navigate(['/buildings', buildingId, 'floors', floorId, 'editor']);
  }

  selectTool(tool: EditorTool): void {
    this.selectedTool.set(tool);
    if (tool !== 'Select') this.selection.set(undefined);
  }
  selectArea(areaId: string): void {
    const area = this.areas().find(item => item.id === areaId);
    if (!area) return;
    this.selection.set({ kind: 'area', id: area.id });
    this.deviceTargetAreaId = area.id;
    this.selectedTool.set('Select');
    this.loadAreaProperties(area);
  }
  selectUnassignedSpace(spaceId: string): void { this.linkedSpaceId.set(spaceId); this.selectedTool.set('Area'); }
  selectDevice(deviceId: string): void {
    const device = this.floorDevices().find(item => item.id === deviceId);
    if (!device) return;
    this.selection.set({ kind: 'device', id: device.id });
    this.deviceDisplayName.set(device.displayName ?? '');
    this.selectedTool.set(device.floorPlanPosition ? 'Select' : 'Device');
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return; this.imageError.set(undefined);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { this.imageError.set('Use a JPG, PNG or WEBP image.'); return; }
    if (file.size > 8 * 1024 * 1024) { this.imageError.set('The floor plan image must be smaller than 8 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') { this.checkpoint(); this.planImageUrl.set(reader.result); } };
    reader.onerror = () => this.imageError.set('The selected image could not be loaded.'); reader.readAsDataURL(file);
  }
  removeImage(): void { if (this.planImageUrl()) { this.checkpoint(); this.planImageUrl.set(undefined); } }

  pointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const point = this.eventPoint(event); const tool = this.selectedTool();
    if (tool === 'Device') { if (this.selectedDevice()) this.placeSelectedDevice(point); return; }
    if (tool === 'Select') { this.selection.set(undefined); return; }
    if (tool === 'Pan') this.drag = { mode: 'pan', start: { x: event.clientX, y: event.clientY }, current: point, originalView: this.viewOrigin() };
    else { this.drag = { mode: 'draw', start: point, current: point }; this.draft.set({ x: point.x, y: point.y, width: 0, height: 0 }); }
    this.canvas?.nativeElement.setPointerCapture(event.pointerId);
  }
  pointerMove(event: PointerEvent): void {
    if (!this.drag) return;
    if (this.drag.mode === 'pan') {
      const width = this.canvas?.nativeElement.getBoundingClientRect().width || 1; const scale = (1000 / this.zoom()) / width;
      this.viewOrigin.set({ x: (this.drag.originalView?.x ?? 0) - (event.clientX - this.drag.start.x) * scale, y: (this.drag.originalView?.y ?? 0) - (event.clientY - this.drag.start.y) * scale });
      return;
    }
    const point = this.eventPoint(event); this.drag.current = point;
    if (this.drag.mode === 'draw') this.draft.set(this.rectFromPoints(this.drag.start, point));
    else if (this.drag.mode === 'device') {
      if (!this.drag.deviceMoved) { this.checkpoint(); this.drag.deviceMoved = true; }
      this.moveDeviceLocally(this.drag.selection!.id, this.drag.originalDevice!.spaceId, point);
    }
    else if (this.drag.mode === 'move') this.transformSelection(this.drag, point, false);
    else this.transformSelection(this.drag, point, true);
  }
  pointerUp(event: PointerEvent): void {
    if (!this.drag) return;
    if (this.drag.mode === 'draw') this.finishDrawing();
    else if (this.drag.mode === 'device' && this.drag.deviceMoved) this.finishDeviceDrag(this.drag);
    else if (this.drag.invalidPlacement) this.showOverlapWarning();
    this.drag = undefined; this.draft.set(undefined);
    if (this.canvas?.nativeElement.hasPointerCapture(event.pointerId)) this.canvas.nativeElement.releasePointerCapture(event.pointerId);
  }
  beginMove(event: PointerEvent, kind: Selection['kind'], id: string): void {
    if (this.selectedTool() !== 'Select') return;
    event.stopPropagation(); const selected = { kind, id } as Selection; this.selection.set(selected);
    if (kind === 'area') this.loadAreaProperties(this.areas().find(area => area.id === id)!);
    const point = this.eventPoint(event); this.checkpoint();
    const originalElement = this.elements().find(element => element.id === id);
    this.drag = {
      mode: 'move', start: point, current: point, selection: selected,
      originalElement: structuredClone(originalElement),
      originalSpace: kind === 'area' && originalElement ? structuredClone(this.areaSpace(originalElement)) : undefined,
    };
    this.canvas?.nativeElement.setPointerCapture(event.pointerId);
  }
  beginResize(event: PointerEvent): void {
    const selected = this.selection(); if (!selected) return;
    event.stopPropagation(); const point = this.eventPoint(event); this.checkpoint();
    const originalElement = this.elements().find(element => element.id === selected.id);
    this.drag = {
      mode: 'resize', start: point, current: point, selection: selected,
      originalElement: structuredClone(originalElement),
      originalSpace: selected.kind === 'area' && originalElement ? structuredClone(this.areaSpace(originalElement)) : undefined,
    };
    this.canvas?.nativeElement.setPointerCapture(event.pointerId);
  }

  beginDeviceDrag(event: PointerEvent, deviceId: string): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    const device = this.floorDevices().find(item => item.id === deviceId);
    if (!device) return;
    this.selectDevice(device.id);
    this.selectedTool.set('Select');
    const point = this.eventPoint(event);
    this.drag = {
      mode: 'device', start: point, current: point,
      selection: { kind: 'device', id: device.id },
      originalDevice: structuredClone(device),
      deviceMoved: false,
      dirtyBefore: this.hasUnsavedChanges(),
    };
    this.canvas?.nativeElement.setPointerCapture(event.pointerId);
  }

  applyAreaChanges(): void {
    const area = this.selectedArea(); if (!area || !this.areaName().trim()) return;
    const targetId = this.linkedSpaceId();
    const other = targetId ? this.areas().find(item => item.id !== area.id && item.spaceId === targetId) : undefined;
    if (other) { this.assignmentConflict.set({ areaId: area.id, targetSpaceId: targetId, otherAreaId: other.id }); return; }
    this.applyArea(area, targetId || undefined);
  }
  resolveConflict(action: 'cancel' | 'replace' | 'new'): void {
    const conflict = this.assignmentConflict(); if (!conflict) return;
    this.assignmentConflict.set(undefined);
    const area = this.areas().find(item => item.id === conflict.areaId); if (!area) return;
    if (action === 'cancel') { this.linkedSpaceId.set(area.spaceId ?? ''); return; }
    if (action === 'new') { this.applyArea(area, undefined, true); return; }
    const other = this.areas().find(item => item.id === conflict.otherAreaId);
    const target = this.spaces().find(space => space.id === conflict.targetSpaceId);
    if (other && target) {
      const replacement = this.newSpaceForArea(other, `${target.name} Area`);
      this.spaces.update(spaces => [...spaces, replacement]);
      this.elements.update(elements => elements.map(item => item.id === other.id ? { ...item, spaceId: replacement.id, label: replacement.name } : item));
    }
    this.applyArea(area, conflict.targetSpaceId);
  }

  requestDeleteArea(): void { const area = this.selectedArea(); if (area) this.deleteCandidate.set(area); }
  deleteAreaOnly(): void {
    const area = this.deleteCandidate(); if (!area) return; this.checkpoint();
    this.elements.update(elements => elements.filter(item => item.id !== area.id));
    if (area.spaceId) this.spaces.update(spaces => spaces.map(space => space.id === area.spaceId ? { ...space, polygon: [] } : space));
    this.deleteCandidate.set(undefined); this.selection.set(undefined);
  }
  deleteAreaAndSpace(): void {
    const area = this.deleteCandidate(); if (!area) return; this.checkpoint();
    this.elements.update(elements => elements.filter(item => item.id !== area.id));
    if (area.spaceId) this.spaces.update(spaces => spaces.filter(space => space.id !== area.spaceId));
    this.deleteCandidate.set(undefined); this.selection.set(undefined);
  }
  deleteStructuralElement(): void {
    const element = this.selectedElement(); if (!element) return; this.checkpoint();
    this.elements.update(elements => elements.filter(item => item.id !== element.id)); this.selection.set(undefined);
  }

  addDevice(): void {
    const targetArea = this.selectedArea() ?? this.areas().find(area => area.id === this.deviceTargetAreaId) ?? this.areas()[0];
    const targetSpace = targetArea ? this.areaSpace(targetArea) : undefined;
    if (!targetArea || !targetSpace) {
      this.snackBar.open('Create a monitored Area before adding devices.', 'Close', { duration: 2800 });
      return;
    }
    const type = this.newDeviceType();
    const code = this.newDeviceCode().trim() || this.nextDeviceCode(type);
    const name = this.newDeviceName().trim() || `${type} Sensor ${code}`;
    const position = { x: targetArea.x + targetArea.width / 2, y: targetArea.y + targetArea.height / 2 };
    const now = new Date();
    const status = this.newDeviceStatus();
    const unit: Record<DeviceType, string> = { Temperature: '°C', Smoke: 'ppm', Gas: 'ppm', Humidity: '%', Motion: 'events' };
    const device: Device = {
      id: this.uniqueId('device'), organizationId: 'securitybear', deviceCode: code,
      spaceId: targetSpace.id, displayName: this.newDeviceDisplayName().trim() || undefined,
      name, code, type, status, floorPlanPosition: position,
      description: this.newDeviceDescription().trim() || 'Device created from the Floor Plan Editor.',
      specifications: {
        manufacturer: this.newDeviceManufacturer().trim() || 'Unspecified',
        model: this.newDeviceModel().trim() || `${type} Sensor`,
        serialNumber: this.newDeviceSerialNumber().trim() || code,
        firmware: 'v1.0.0', protocol: 'Wi-Fi', samplingIntervalSeconds: 60,
      },
      assignment: { buildingId: targetSpace.buildingId, floorId: targetSpace.floorId, zoneId: targetSpace.id, spaceId: targetSpace.id },
      administrativeStatus: 'ACTIVE',
      connectivityStatus: status === 'Offline' ? 'OFFLINE' : 'ONLINE',
      healthStatus: status === 'Critical' ? 'CRITICAL' : status === 'Warning' ? 'WARNING' : 'NORMAL',
      capabilities: [{ id: `${code}-measurement`, code: `${type.toLowerCase()}_measurement`, name: `${type} Measurement`, kind: 'MEASUREMENT', hardware: `${type} sensing module`, unit: unit[type] }],
      power: { source: 'Battery', status: 'ON_BATTERY', batteryPercentage: 100 },
      lastSeen: now, readings: [], firmware: 'v1.0.0', battery: 100, signal: -50, signalStrength: -50,
      hardwareComponents: [{ name: `${type} sensing module`, role: 'Measurement hardware' }],
      createdAt: now, updatedAt: now, version: 1,
    };
    this.checkpoint();
    this.spaces.update(spaces => spaces.map(space => space.id === targetSpace.id ? { ...space, devices: [...space.devices, device] } : space));
    this.store.createDevice(device);
    this.newDeviceDisplayName.set(''); this.newDeviceName.set(''); this.newDeviceCode.set('');
    this.newDeviceDescription.set(''); this.newDeviceManufacturer.set(''); this.newDeviceModel.set(''); this.newDeviceSerialNumber.set('');
    this.selectDevice(device.id);
  }

  applyDeviceChanges(): void {
    const device = this.selectedDevice(); if (!device) return;
    const updated = { ...device, displayName: this.deviceDisplayName().trim() || undefined };
    this.checkpoint();
    this.replaceLocalDevice(updated);
    this.store.updateDevice(updated);
  }

  removeSelectedDevicePosition(): void {
    const device = this.selectedDevice(); if (!device) return;
    this.checkpoint();
    const updated = { ...device, floorPlanPosition: undefined };
    this.replaceLocalDevice(updated);
    this.store.removeDevicePosition(device.id);
    this.selectedTool.set('Device');
  }

  deleteSelectedDevice(): void {
    const device = this.selectedDevice(); if (!device) return;
    if (!window.confirm(`Delete ${device.displayName || device.name}?`)) return;
    this.checkpoint();
    this.spaces.update(spaces => spaces.map(space => ({ ...space, devices: space.devices.filter(item => item.id !== device.id) })));
    this.store.deleteDevice(device.id);
    this.selection.set(undefined); this.selectedTool.set('Select');
  }

  updateAreaGeometry(property: 'x' | 'y' | 'width' | 'height', raw: string): void {
    const area = this.selectedArea(); const value = this.snap(Number(raw)); if (!area || !Number.isFinite(value)) return;
    const updated = { ...area, [property]: property === 'width' || property === 'height' ? Math.max(10, value) : value };
    if (this.overlapsAnotherArea(updated, area.id)) { this.showOverlapWarning(); return; }
    this.checkpoint();
    this.replaceElement(updated); this.syncSpaceGeometry(area, updated);
  }
  updateElementNumber(property: 'x' | 'y' | 'width' | 'height' | 'rotation', raw: string): void {
    const element = this.selectedElement(); const value = Number(raw); if (!element || !Number.isFinite(value)) return;
    this.checkpoint(); this.replaceElement({ ...element, [property]: value });
  }
  updateElementLabel(label: string): void { const element = this.selectedElement(); if (element) { this.checkpoint(); this.replaceElement({ ...element, label }); } }

  zoomIn(): void { this.zoom.update(value => Math.min(3, Number((value + .25).toFixed(2)))); }
  zoomOut(): void { this.zoom.update(value => Math.max(.5, Number((value - .25).toFixed(2)))); }
  fit(): void { this.zoom.set(1); this.viewOrigin.set({ x: 0, y: 0 }); }
  resetView(): void { this.fit(); this.selection.set(undefined); }
  undo(): void { const state = this.undoStack.pop(); if (!state) return; this.redoStack.push(this.snapshot()); this.restore(state); this.updateHistoryState(); }
  redo(): void { const state = this.redoStack.pop(); if (!state) return; this.undoStack.push(this.snapshot()); this.restore(state); this.updateHistoryState(); }
  clearPlan(): void {
    if (!window.confirm('Clear Floor Plan?\n\nThis will remove all visual elements and device positions from this floor.')) return;
    const removeImage = this.planImageUrl() ? window.confirm('Also remove the uploaded background image?') : false; this.checkpoint();
    this.spaces.update(spaces => spaces.map(space => ({ ...space, polygon: [], devices: space.devices.map(device => ({ ...device, floorPlanPosition: undefined })) })));
    this.elements.set([]); if (removeImage) this.planImageUrl.set(undefined); this.selection.set(undefined);
  }

  save(): void {
    const building = this.building(); const floor = this.floor(); if (!building || !floor) return;
    if (this.hasAreaOverlaps()) { this.showOverlapWarning(); return; }
    const localIds = new Set(this.spaces().map(space => space.id));
    for (const existing of this.store.getFloor(building.id, floor.id)?.spaces ?? []) if (!localIds.has(existing.id)) this.store.deleteSpace(building.id, floor.id, existing.id);
    for (const space of this.spaces()) {
      if (this.store.getSpace(building.id, floor.id, space.id)) this.store.updateSpace(building.id, floor.id, space); else this.store.addSpace(building.id, floor.id, space);
    }
    this.store.syncFloorDevices(building.id, floor.id, this.floorDevices());
    this.store.updateFloorPlan(building.id, floor.id, { planImageUrl: this.planImageUrl(), planElements: this.elements(), planConfigured: this.areas().length > 0 });
    this.floor.set(this.store.getFloor(building.id, floor.id));
    this.hasUnsavedChanges.set(false);
    this.snackBar.open('Floor plan saved successfully', 'Close', { duration: 3000, horizontalPosition: 'right', verticalPosition: 'top' });
  }

  areaSpace(area: FloorPlanElement): Space | undefined { return area.spaceId ? this.spaces().find(space => space.id === area.spaceId) : undefined; }
  isAreaConfigured(area: FloorPlanElement): boolean { const space = this.areaSpace(area); return !!space && !/^Area \d+$/.test(space.name); }
  areaNameFor(area: FloorPlanElement): string { return this.areaSpace(area)?.name ?? area.label ?? 'Unconfigured Area'; }
  areaRoomFor(area: FloorPlanElement): string { return this.areaSpace(area)?.roomNumber ?? ''; }
  conflictSpaceName(conflict: AssignmentConflict): string {
    const area = this.areas().find(item => item.id === conflict.otherAreaId);
    return area ? this.areaNameFor(area) : 'This space';
  }
  pointsForArea(area: FloorPlanElement): string { return this.points(this.rectPolygon(area)); }
  points(points: FloorPlanPoint[]): string { return points.map(point => `${point.x},${point.y}`).join(' '); }
  deviceLetter(device: Device): string { return device.type.charAt(0); }
  deviceStatus(device: Device): string { return device.status.toLowerCase(); }
  devicePosition(devices: Device[], index: number): FloorPlanPoint | undefined { return visualDevicePosition(devices, index); }
  deviceLabel(device: Device): string { return device.displayName || device.name; }
  assignedSpaceLabel(device: Device): string { const space = this.spaces().find(item => item.id === device.spaceId); return space ? `${space.name} ${space.roomNumber ?? ''}`.trim() : 'Unassigned'; }
  elementLabel(element: FloorPlanElement): string { return element.label ?? element.type; }
  isStairArea(area: FloorPlanElement): boolean { return this.areaSpace(area)?.type === 'Stairs'; }
  bounds(points: FloorPlanPoint[]): { x: number; y: number; width: number; height: number } {
    if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
    const xs = points.map(point => point.x); const ys = points.map(point => point.y); const x = Math.min(...xs); const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }

  private finishDrawing(): void {
    const rect = this.draft(); if (!rect || rect.width < 10 || rect.height < 10) return;
    const tool = this.selectedTool();
    if (tool === 'Area' || tool === 'Hallway' || tool === 'Stairs' || tool === 'Restroom') {
      if (this.overlapsAnotherArea(rect)) { this.showOverlapWarning(); return; }
      this.checkpoint();
      const number = this.nextAreaNumber(); const areaId = this.uniqueId('plan-area');
      const targetId = tool === 'Area' ? this.linkedSpaceId() : '';
      const target = targetId
        ? this.spaces().find(space => space.id === targetId && !this.areas().some(area => area.spaceId === targetId))
        : undefined;
      const spatialType: SpaceType = tool === 'Hallway' ? 'Hallway' : tool === 'Stairs' ? 'Stairs' : tool === 'Restroom' ? 'Restroom' : 'Other';
      const defaultName = tool === 'Hallway' ? 'Hallway' : tool === 'Stairs' ? 'Stairs' : tool === 'Restroom' ? 'Restroom' : `Area ${number}`;
      const space = target
        ? { ...target, polygon: this.rectPolygon(rect) }
        : {
            ...this.createPlaceholderSpace(number, rect),
            name: defaultName,
            type: spatialType,
            sensitivity: tool === 'Hallway' || tool === 'Stairs' ? 'Low' as const : 'Normal' as const,
            thresholds: this.thresholdsFor(spatialType),
          };
      if (target) this.spaces.update(spaces => spaces.map(item => item.id === target.id ? space : item)); else this.spaces.update(spaces => [...spaces, space]);
      const area: FloorPlanElement = { id: areaId, type: 'Space', spaceId: space.id, label: space.name, ...rect };
      this.elements.update(elements => [...elements, area]);
      this.selection.set({ kind: 'area', id: area.id }); this.loadAreaProperties(area); this.selectedTool.set('Select');
      return;
    }
    this.checkpoint();
    const type = tool as FloorPlanElementType; const thin = type === 'Wall' || type === 'Door';
    const element: FloorPlanElement = { id: this.uniqueId(type.toLowerCase()), type, ...rect, height: thin ? Math.max(5, Math.min(rect.height, 10)) : rect.height, label: type === 'Restroom' ? 'WC' : type };
    this.elements.update(elements => [...elements, element]); this.selection.set({ kind: 'element', id: element.id }); this.selectedTool.set('Select');
  }

  private applyArea(area: FloorPlanElement, targetSpaceId?: string, forceNew = false): void {
    this.checkpoint(); let target = !forceNew && targetSpaceId ? this.spaces().find(space => space.id === targetSpaceId) : undefined;
    if (!target) target = this.newSpaceForArea(area, this.areaName().trim());
    const previousId = area.spaceId;
    const updatedSpace: Space = { ...target, name: this.areaName().trim(), roomNumber: this.areaRoomNumber().trim() || undefined, type: this.areaType(), sensitivity: this.areaSensitivity(), thresholds: target.thresholds ?? this.thresholdsFor(this.areaType()), polygon: this.rectPolygon(area) };
    this.spaces.update(spaces => {
      let next = spaces.map(space => space.id === updatedSpace.id ? updatedSpace : space);
      if (!spaces.some(space => space.id === updatedSpace.id)) next = [...next, updatedSpace];
      if (previousId && previousId !== updatedSpace.id) next = next.map(space => space.id === previousId ? { ...space, polygon: [] } : space);
      return next;
    });
    this.replaceElement({ ...area, spaceId: updatedSpace.id, label: updatedSpace.name });
    this.linkedSpaceId.set(updatedSpace.id);
  }
  private createPlaceholderSpace(number: number, rect: { x: number; y: number; width: number; height: number }): Space {
    const floor = this.floor()!; return { id: this.uniqueId(`${floor.id}-space`), buildingId: floor.buildingId, floorId: floor.id, name: `Area ${number}`, type: 'Other', sensitivity: 'Normal', status: 'Normal', thresholds: this.thresholdsFor('Other'), polygon: this.rectPolygon(rect), devices: [] };
  }
  private newSpaceForArea(area: FloorPlanElement, name: string): Space {
    const floor = this.floor()!; return { id: this.uniqueId(`${floor.id}-space`), buildingId: floor.buildingId, floorId: floor.id, name: name || area.label || 'Area', roomNumber: this.areaRoomNumber().trim() || undefined, type: this.areaType(), sensitivity: this.areaSensitivity(), status: 'Normal', thresholds: this.thresholdsFor(this.areaType()), polygon: this.rectPolygon(area), devices: [] };
  }
  private loadAreaProperties(area: FloorPlanElement): void {
    const space = this.areaSpace(area); this.areaName.set(space?.name ?? area.label ?? ''); this.areaRoomNumber.set(space?.roomNumber ?? ''); this.areaType.set(space?.type ?? 'Office'); this.areaSensitivity.set(space?.sensitivity ?? 'Normal'); this.linkedSpaceId.set(space?.id ?? '');
  }
  private transformSelection(drag: DragState, point: FloorPlanPoint, resize: boolean): void {
    const original = drag.originalElement; if (!original) return;
    const updated = resize
      ? { ...original, width: Math.max(10, this.snap(point.x) - original.x), height: Math.max(10, this.snap(point.y) - original.y) }
      : { ...original, x: original.x + this.snap(point.x - drag.start.x), y: original.y + this.snap(point.y - drag.start.y) };
    if (updated.type === 'Space' && this.overlapsAnotherArea(updated, updated.id)) { drag.invalidPlacement = true; return; }
    drag.invalidPlacement = false;
    this.replaceElement(updated);
    if (updated.type === 'Space') this.syncSpaceGeometry(original, updated, drag.originalSpace);
  }
  private syncSpaceGeometry(previous: FloorPlanElement, updated: FloorPlanElement, originalSpace?: Space): void {
    if (!updated.spaceId) return;
    this.spaces.update(spaces => spaces.map(space => {
      if (space.id !== updated.spaceId) return space;
      const source = originalSpace?.id === space.id ? originalSpace : space;
      const devices = source.devices.map(device => {
        const position = device.floorPlanPosition;
        if (!position) return device;
        const relativeX = previous.width > 0 ? (position.x - previous.x) / previous.width : .5;
        const relativeY = previous.height > 0 ? (position.y - previous.y) / previous.height : .5;
        const safeX = Math.min(.98, Math.max(.02, relativeX));
        const safeY = Math.min(.98, Math.max(.02, relativeY));
        return {
          ...device,
          floorPlanPosition: {
            x: updated.x + safeX * updated.width,
            y: updated.y + safeY * updated.height,
          },
        };
      });
      return { ...space, polygon: this.rectPolygon(updated), devices };
    }));
  }
  private replaceElement(updated: FloorPlanElement): void { this.elements.update(elements => elements.map(element => element.id === updated.id ? updated : element)); }
  private placeSelectedDevice(point: FloorPlanPoint): void {
    const device = this.selectedDevice(); const target = this.spaceAt(point);
    if (!device || !target) { this.snackBar.open('Device must be placed inside a monitored space.', 'Close', { duration: 2800 }); return; }
    this.checkpoint(); this.moveDeviceLocally(device.id, target.id, point); this.store.moveDevice(device.id, target.id, point);
    this.selectedTool.set('Select');
  }

  private finishDeviceDrag(drag: DragState): void {
    const original = drag.originalDevice; if (!original) return;
    const target = this.spaceAt(drag.current);
    if (!target) {
      this.moveDeviceLocally(original.id, original.spaceId, original.floorPlanPosition);
      this.undoStack.pop(); this.hasUnsavedChanges.set(drag.dirtyBefore ?? false); this.updateHistoryState();
      this.snackBar.open('Device must be placed inside a monitored space.', 'Close', { duration: 2800 });
      return;
    }
    this.moveDeviceLocally(original.id, target.id, drag.current);
    this.store.moveDevice(original.id, target.id, drag.current);
    this.selectDevice(original.id);
  }

  private spaceAt(point: FloorPlanPoint): Space | undefined { return this.spaces().find(space => space.polygon.length >= 3 && this.pointInPolygon(point, space.polygon)); }

  private moveDeviceLocally(deviceId: string, targetSpaceId: string, position?: FloorPlanPoint): void {
    const current = this.floorDevices().find(device => device.id === deviceId);
    if (!current) return;
    const updated = { ...current, spaceId: targetSpaceId, floorPlanPosition: position };
    this.spaces.update(spaces => spaces.map(space => ({
      ...space,
      devices: space.id === targetSpaceId
        ? [...space.devices.filter(device => device.id !== deviceId), updated]
        : space.devices.filter(device => device.id !== deviceId),
    })));
  }

  private replaceLocalDevice(updated: Device): void {
    this.spaces.update(spaces => spaces.map(space => ({ ...space, devices: space.devices.map(device => device.id === updated.id ? updated : device) })));
  }

  private nextDeviceCode(type: DeviceType): string {
    const prefix: Record<DeviceType, string> = { Temperature: 'TEMP', Smoke: 'SMOKE', Gas: 'GAS', Humidity: 'HUM', Motion: 'MOTION' };
    const used = new Set(this.store.devices().map(device => device.code.toUpperCase()));
    let number = 1; while (used.has(`${prefix[type]}-${String(number).padStart(3, '0')}`)) number++;
    return `${prefix[type]}-${String(number).padStart(3, '0')}`;
  }
  private eventPoint(event: PointerEvent): FloorPlanPoint {
    const svg = this.canvas?.nativeElement; if (!svg) return { x: 0, y: 0 }; const rect = svg.getBoundingClientRect(); const width = 1000 / this.zoom(); const height = 500 / this.zoom(); const origin = this.viewOrigin();
    return { x: this.snap(origin.x + ((event.clientX - rect.left) / rect.width) * width), y: this.snap(origin.y + ((event.clientY - rect.top) / rect.height) * height) };
  }
  private rectFromPoints(a: FloorPlanPoint, b: FloorPlanPoint) { return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }; }
  private rectPolygon(rect: { x: number; y: number; width: number; height: number }): FloorPlanPoint[] { return [{ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height }, { x: rect.x, y: rect.y + rect.height }]; }
  private overlapsAnotherArea(candidate: { x: number; y: number; width: number; height: number }, excludedId?: string): boolean {
    return this.areas().some(area => area.id !== excludedId
      && candidate.x < area.x + area.width
      && candidate.x + candidate.width > area.x
      && candidate.y < area.y + area.height
      && candidate.y + candidate.height > area.y);
  }
  private hasAreaOverlaps(): boolean {
    return this.areas().some((area, index, areas) => areas.slice(index + 1).some(other =>
      area.x < other.x + other.width
      && area.x + area.width > other.x
      && area.y < other.y + other.height
      && area.y + area.height > other.y));
  }
  private showOverlapWarning(): void {
    this.snackBar.open('Spaces cannot overlap. Choose an unoccupied area.', 'Close', { duration: 3200 });
  }
  private snap(value: number): number { return this.snapEnabled() ? Math.round(value / 25) * 25 : Math.round(value * 10) / 10; }
  private pointInPolygon(point: FloorPlanPoint, polygon: FloorPlanPoint[]): boolean { let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i]; const b = polygon[j]; if (((a.y > point.y) !== (b.y > point.y)) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside; } return inside; }
  private nextAreaNumber(): number { const numbers = this.areas().map(area => Number((area.label ?? '').match(/^Area (\d+)$/)?.[1] ?? 0)); return Math.max(0, ...numbers) + 1; }
  private uniqueId(prefix: string): string { this.uniqueCounter += 1; return `${prefix}-${Date.now().toString(36)}-${this.uniqueCounter.toString(36)}`; }
  private checkpoint(): void { this.undoStack.push(this.snapshot()); if (this.undoStack.length > 30) this.undoStack.shift(); this.redoStack = []; this.hasUnsavedChanges.set(true); this.updateHistoryState(); }
  private snapshot(): EditorSnapshot { return { spaces: structuredClone(this.spaces()), elements: structuredClone(this.elements()), image: this.planImageUrl() }; }
  private restore(state: EditorSnapshot): void {
    this.spaces.set(structuredClone(state.spaces)); this.elements.set(structuredClone(state.elements)); this.planImageUrl.set(state.image); this.selection.set(undefined);
    const building = this.building(); const floor = this.floor();
    if (building && floor) this.store.syncFloorDevices(building.id, floor.id, this.floorDevices());
  }
  private updateHistoryState(): void { this.canUndo.set(this.undoStack.length > 0); this.canRedo.set(this.redoStack.length > 0); }
  private thresholdsFor(type: SpaceType): SpaceThresholds { return type === 'Laboratory' ? { Temperature: { warning: 28, critical: 35 }, Smoke: { warning: 80, critical: 120 }, Gas: { warning: 200, critical: 300 }, Humidity: { warning: 70, critical: 85 } } : type === 'ServerRoom' ? { Temperature: { warning: 27, critical: 32 }, Smoke: { warning: 60, critical: 100 }, Gas: { warning: 250, critical: 400 }, Humidity: { warning: 65, critical: 80 } } : { Temperature: { warning: 32, critical: 40 }, Smoke: { warning: 100, critical: 150 }, Gas: { warning: 250, critical: 400 }, Humidity: { warning: 70, critical: 85 } }; }
}
