import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DeviceStatus, Floor, FloorPlanElement, FloorPlanPoint, RiskStatus } from '../../../core/models/resq.models';
import { floorPlanShape, floorPlanToWorldCoordinates, riskColor } from '../../../shared/three/floor-plan-three.utils';
import { visualDevicePosition } from '../../../shared/utils/floor-plan-device.utils';

const ROOM_HEIGHT = .75;
const HALLWAY_HEIGHT = .14;
const FLOOR_GAP = 1.15;
const CONTEXT_COLOR = 0xaeb9c5;

@Component({
  selector: 'resq-three-floor-viewer',
  standalone: true,
  template: '<div #host class="viewer" role="application" aria-label="Interactive 3D floor view"><div #tooltip class="device-tooltip"></div></div>',
  styles: [':host{display:block;height:clamp(440px,56vh,680px);background:linear-gradient(180deg,#f5f8fc,#e8eef5)}.viewer{position:relative;width:100%;height:100%;cursor:grab}.viewer:active{cursor:grabbing}canvas{display:block;width:100%;height:100%}.device-tooltip{display:none;position:absolute;z-index:3;max-width:240px;padding:7px 9px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;color:#344054;box-shadow:0 6px 18px rgb(16 24 40 / 18%);font:600 12px/1.45 system-ui;pointer-events:none;white-space:nowrap}'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreeFloorViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) floors: Floor[] = [];
  @Input({ required: true }) selectedFloorId = '';
  @Input() selectedSpaceId = '';
  @Output() readonly spaceSelected = new EventEmitter<string>();
  @Output() readonly deviceSelected = new EventEmitter<string>();
  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;
  @ViewChild('tooltip', { static: true }) private tooltip!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private resizeObserver?: ResizeObserver;
  private animationFrame = 0;
  private readonly roomMeshes = new Map<string, THREE.Mesh[]>();
  private readonly deviceMeshes: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  ngAfterViewInit(): void {
    this.initialize();
    this.rebuildFloors();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.scene) return;
    if (changes['floors'] || changes['selectedFloorId']) this.rebuildFloors();
    else if (changes['selectedSpaceId']) this.updateSelection();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.host.nativeElement.removeEventListener('pointerup', this.onPointerUp);
    this.host.nativeElement.removeEventListener('pointermove', this.onPointerMove);
    this.host.nativeElement.removeEventListener('pointerleave', this.hideDeviceTooltip);
    this.controls?.dispose();
    this.disposeSceneObjects();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
  }

  private initialize(): void {
    const host = this.host.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f7fb);
    this.camera = new THREE.PerspectiveCamera(42, host.clientWidth / Math.max(host.clientHeight, 1), .1, 100);
    this.camera.position.set(11, 10, 12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 34;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.target.set(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8fa3b8, 1.6));
    const directional = new THREE.DirectionalLight(0xffffff, 2.2);
    directional.position.set(7, 12, 8);
    directional.castShadow = true;
    directional.shadow.mapSize.set(1024, 1024);
    this.scene.add(directional);

    host.addEventListener('pointerup', this.onPointerUp);
    host.addEventListener('pointermove', this.onPointerMove);
    host.addEventListener('pointerleave', this.hideDeviceTooltip);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.zone.runOutsideAngular(() => this.animate());
  }

  private rebuildFloors(): void {
    if (!this.scene || !this.floors.length) return;
    this.disposeSceneObjects();
    this.roomMeshes.clear();
    this.deviceMeshes.length = 0;

    const sortedFloors = [...this.floors].sort((a, b) => a.level - b.level);
    sortedFloors.forEach((floor, floorIndex) => {
      const baseY = floorIndex * FLOOR_GAP;
      const activeFloor = floor.id === this.selectedFloorId;

      for (const space of floor.spaces) {
        if (space.polygon.length < 3) continue;
        const selected = activeFloor && space.id === this.selectedSpaceId;
        const meshes: THREE.Mesh[] = [];
        if (space.type === 'Stairs') {
          const xs = space.polygon.map(point => point.x);
          const ys = space.polygon.map(point => point.y);
          const x = Math.min(...xs); const y = Math.min(...ys);
          const width = Math.max(...xs) - x; const height = Math.max(...ys) - y;
          const steps = 7;
          for (let index = 0; index < steps; index++) {
            const stepHeight = height / steps;
            const stepPolygon = [
              { x, y: y + index * stepHeight }, { x: x + width, y: y + index * stepHeight },
              { x: x + width, y: y + (index + 1) * stepHeight }, { x, y: y + (index + 1) * stepHeight },
            ];
            const geometry = new THREE.ExtrudeGeometry(floorPlanShape(stepPolygon), {
              depth: .12 + (index / (steps - 1)) * .58,
              bevelEnabled: false,
            });
            geometry.rotateX(-Math.PI / 2);
            const mesh = new THREE.Mesh(geometry, this.roomMaterial(space.status, activeFloor, selected));
            mesh.position.y = baseY;
            mesh.castShadow = activeFloor;
            mesh.receiveShadow = true;
            mesh.userData = { generated: true, floorId: floor.id, spaceId: space.id, status: space.status };
            meshes.push(mesh);
            this.scene!.add(mesh);
          }
        } else {
          const geometry = new THREE.ExtrudeGeometry(
            floorPlanShape(space.polygon),
            { depth: ROOM_HEIGHT, bevelEnabled: false },
          );
          geometry.rotateX(-Math.PI / 2);
          const mesh = new THREE.Mesh(geometry, this.roomMaterial(space.status, activeFloor, selected));
          mesh.position.y = baseY;
          mesh.castShadow = activeFloor;
          mesh.receiveShadow = true;
          mesh.userData = { generated: true, floorId: floor.id, spaceId: space.id, status: space.status };
          meshes.push(mesh);
          this.scene!.add(mesh);

          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({
              color: selected ? 0x1570ef : 0x52677d,
              transparent: true,
              opacity: activeFloor ? .72 : .3,
            }),
          );
          edges.position.y = baseY;
          edges.userData = { generated: true, floorId: floor.id, spaceId: space.id };
          this.scene!.add(edges);
        }
        this.roomMeshes.set(space.id, meshes);

        if (!activeFloor) continue;
        const activeDevices = space.devices.filter(device =>
          device.assignment.floorId === floor.id && device.spaceId === space.id
        );
        for (const [deviceIndex, device] of activeDevices.entries()) {
          const visualPosition = visualDevicePosition(activeDevices, deviceIndex);
          if (!visualPosition) continue;
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(.13, 18, 12),
            new THREE.MeshStandardMaterial({ color: this.deviceColor(device.status), roughness: .5 }),
          );
          const world = floorPlanToWorldCoordinates(visualPosition);
          marker.position.set(world.x, baseY + (space.type === 'Stairs' ? .88 : ROOM_HEIGHT + .18), world.z);
          marker.castShadow = true;
          marker.userData = {
            generated: true,
            deviceId: device.id,
            spaceId: space.id,
            tooltip: `${device.displayName || device.name} · ${device.name} · ${device.code} · ${device.type} · ${device.status} · ${space.name} ${space.roomNumber ?? ''}`,
          };
          this.deviceMeshes.push(marker);
          this.scene!.add(marker);
        }
      }

      // Hallways remain structural elements in the editor. Build their 3D
      // footprint from that same plan element and keep the actual Space as owner.
      const hallwaySpaces = floor.spaces.filter(space => space.type === 'Hallway' && space.polygon.length < 3);
      const hallwayElements = (floor.planElements ?? []).filter(element => element.type === 'Hallway');
      const renderedStructuralIds = new Set<string>();
      hallwayElements.forEach((element, index) => {
        const hallway = hallwaySpaces.find(space => element.spaceId === space.id)
          ?? hallwaySpaces.find(space => !!element.label && space.name.toLowerCase() === element.label.toLowerCase())
          ?? hallwaySpaces[index];
        if (!hallway) return;
        renderedStructuralIds.add(element.id);

        const polygon = [
          { x: element.x, y: element.y },
          { x: element.x + element.width, y: element.y },
          { x: element.x + element.width, y: element.y + element.height },
          { x: element.x, y: element.y + element.height },
        ];
        const geometry = new THREE.ExtrudeGeometry(
          floorPlanShape(polygon),
          { depth: HALLWAY_HEIGHT, bevelEnabled: false },
        );
        geometry.rotateX(-Math.PI / 2);
        const selected = activeFloor && hallway.id === this.selectedSpaceId;
        const mesh = new THREE.Mesh(geometry, this.roomMaterial(hallway.status, activeFloor, selected));
        mesh.position.y = baseY;
        mesh.receiveShadow = true;
        mesh.userData = { generated: true, floorId: floor.id, spaceId: hallway.id, status: hallway.status };
        this.roomMeshes.set(hallway.id, [mesh]);
        this.scene!.add(mesh);

        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({
            color: selected ? 0x1570ef : 0x60758a,
            transparent: true,
            opacity: activeFloor ? .72 : .3,
          }),
        );
        edges.position.y = baseY;
        edges.userData = { generated: true, floorId: floor.id, spaceId: hallway.id };
        this.scene!.add(edges);

        if (!activeFloor) return;
        const activeDevices = hallway.devices.filter(device =>
          device.assignment.floorId === floor.id && device.spaceId === hallway.id
        );
        for (const [deviceIndex, device] of activeDevices.entries()) {
          const visualPosition = visualDevicePosition(activeDevices, deviceIndex);
          if (!visualPosition) continue;
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(.13, 18, 12),
            new THREE.MeshStandardMaterial({ color: this.deviceColor(device.status), roughness: .5 }),
          );
          const world = floorPlanToWorldCoordinates(visualPosition);
          marker.position.set(world.x, baseY + HALLWAY_HEIGHT + .18, world.z);
          marker.castShadow = true;
          marker.userData = {
            generated: true,
            deviceId: device.id,
            spaceId: hallway.id,
            tooltip: `${device.displayName || device.name} · ${device.name} · ${device.code} · ${device.type} · ${device.status} · ${hallway.name}`,
          };
          this.deviceMeshes.push(marker);
          this.scene!.add(marker);
        }
      });

      // Elements that do not own monitoring data are still part of the physical
      // floor. Render them as context instead of silently dropping them in 3D.
      for (const element of floor.planElements ?? []) {
        if (element.type === 'Space' || renderedStructuralIds.has(element.id)) continue;
        this.addStructuralElement(element, baseY, activeFloor);
      }
    });

    this.fitCamera();
  }

  private updateSelection(): void {
    for (const mesh of [...this.roomMeshes.values()].flat()) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const status = mesh.userData['status'] as RiskStatus;
      const activeFloor = mesh.userData['floorId'] === this.selectedFloorId;
      const selected = activeFloor && mesh.userData['spaceId'] === this.selectedSpaceId;
      const replacement = this.roomMaterial(status, activeFloor, selected);
      material.color.copy(replacement.color);
      material.emissive.copy(replacement.emissive);
      material.opacity = replacement.opacity;
      replacement.dispose();
    }
  }

  private roomMaterial(status: RiskStatus, activeFloor: boolean, selected: boolean): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: activeFloor ? (selected ? 0x72aaf5 : riskColor(status)) : CONTEXT_COLOR,
      emissive: selected ? 0x0b4ea8 : 0x000000,
      emissiveIntensity: selected ? .28 : 0,
      transparent: true,
      opacity: activeFloor ? (selected ? .96 : .9) : .38,
      roughness: .72,
      metalness: .03,
      side: THREE.DoubleSide,
    });
  }

  private deviceColor(status: DeviceStatus): number {
    return ({ Online: 0x1570ef, Warning: 0xf79009, Critical: 0xf04438, Offline: 0x98a2b3 })[status];
  }

  private addStructuralElement(element: FloorPlanElement, baseY: number, activeFloor: boolean): void {
    if (!this.scene || element.width <= 0 || element.height <= 0) return;
    if (element.type === 'Stairs') {
      const steps = 7;
      for (let index = 0; index < steps; index++) {
        const stepHeight = element.height / steps;
        const polygon = this.elementPolygon(element, element.x, element.y + index * stepHeight, element.width, stepHeight);
        const geometry = new THREE.ExtrudeGeometry(floorPlanShape(polygon), {
          depth: .12 + (index / (steps - 1)) * .58,
          bevelEnabled: false,
        });
        geometry.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geometry, this.structuralMaterial(element, activeFloor));
        mesh.position.y = baseY;
        mesh.castShadow = activeFloor;
        mesh.receiveShadow = true;
        mesh.userData = { generated: true, floorId: element.id, structuralElementId: element.id };
        this.scene.add(mesh);
      }
      return;
    }

    const geometry = new THREE.ExtrudeGeometry(
      floorPlanShape(this.elementPolygon(element)),
      { depth: this.structuralHeight(element), bevelEnabled: false },
    );
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, this.structuralMaterial(element, activeFloor));
    mesh.position.y = baseY;
    mesh.castShadow = activeFloor && element.type !== 'Hallway';
    mesh.receiveShadow = true;
    mesh.userData = { generated: true, floorId: element.id, structuralElementId: element.id };
    this.scene.add(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0x52677d, transparent: true, opacity: activeFloor ? .65 : .25 }),
    );
    edges.position.y = baseY;
    edges.userData = { generated: true, floorId: element.id, structuralElementId: element.id };
    this.scene.add(edges);
  }

  private elementPolygon(
    element: FloorPlanElement,
    x = element.x,
    y = element.y,
    width = element.width,
    height = element.height,
  ): FloorPlanPoint[] {
    const points = [
      { x, y }, { x: x + width, y },
      { x: x + width, y: y + height }, { x, y: y + height },
    ];
    const rotation = THREE.MathUtils.degToRad(element.rotation ?? 0);
    if (!rotation) return points;
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    return points.map(point => {
      const offsetX = point.x - centerX;
      const offsetY = point.y - centerY;
      return {
        x: centerX + offsetX * cosine - offsetY * sine,
        y: centerY + offsetX * sine + offsetY * cosine,
      };
    });
  }

  private structuralHeight(element: FloorPlanElement): number {
    return ({ Hallway: .14, Restroom: .58, Wall: .82, Door: .68, Stairs: .7, Space: ROOM_HEIGHT })[element.type];
  }

  private structuralMaterial(element: FloorPlanElement, activeFloor: boolean): THREE.MeshStandardMaterial {
    const color = ({
      Hallway: 0xb8c4ce,
      Restroom: 0x75b9cf,
      Wall: 0x7d8996,
      Door: 0xb9865b,
      Stairs: 0x9aa8b5,
      Space: CONTEXT_COLOR,
    })[element.type];
    return new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: activeFloor ? .9 : .34,
      roughness: .78,
      metalness: .02,
      side: THREE.DoubleSide,
    });
  }

  private fitCamera(): void {
    if (!this.scene || !this.camera || !this.controls) return;
    const generated = this.scene.children.filter(child => child.userData['generated']);
    if (!generated.length) return;
    const bounds = new THREE.Box3();
    generated.forEach(object => bounds.expandByObject(object));
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y * 2, size.z);
    const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.3;
    this.camera.position.set(center.x + distance * .72, center.y + distance * .62, center.z + distance * .82);
    this.camera.near = Math.max(.1, distance / 100);
    this.camera.far = distance * 10;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.camera || !this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const deviceHit = this.raycaster.intersectObjects(this.deviceMeshes, false)[0];
    const deviceId = deviceHit?.object.userData['deviceId'] as string | undefined;
    if (deviceId) { this.zone.run(() => this.deviceSelected.emit(deviceId)); return; }
    const hit = this.raycaster.intersectObjects([...this.roomMeshes.values()].flat(), false)[0];
    const spaceId = hit?.object.userData['spaceId'] as string | undefined;
    if (spaceId) this.zone.run(() => this.spaceSelected.emit(spaceId));
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.camera || !this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.deviceMeshes, false)[0];
    const tooltip = this.tooltip.nativeElement;
    const text = hit?.object.userData['tooltip'] as string | undefined;
    if (!text) { this.hideDeviceTooltip(); return; }
    tooltip.textContent = text;
    tooltip.style.left = `${event.clientX - rect.left + 12}px`;
    tooltip.style.top = `${event.clientY - rect.top + 12}px`;
    tooltip.style.display = 'block';
  };

  private readonly hideDeviceTooltip = (): void => {
    this.tooltip.nativeElement.style.display = 'none';
  };

  private resize(): void {
    if (!this.camera || !this.renderer) return;
    const host = this.host.nativeElement;
    this.camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(host.clientWidth, host.clientHeight);
  }

  private animate = (): void => {
    this.animationFrame = requestAnimationFrame(this.animate);
    this.controls?.update();
    if (this.scene && this.camera) this.renderer?.render(this.scene, this.camera);
  };

  private disposeSceneObjects(): void {
    if (!this.scene) return;
    const generated = this.scene.children.filter(child => child.userData['generated']);
    for (const object of generated) {
      object.traverse(child => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const material of materials) material.dispose();
      });
      this.scene.remove(object);
    }
  }
}
