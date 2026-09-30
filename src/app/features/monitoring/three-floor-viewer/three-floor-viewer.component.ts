import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DeviceStatus, Floor, RiskStatus } from '../../../core/models/resq.models';
import { floorPlanShape, floorPlanToWorldCoordinates, riskColor } from '../../../shared/three/floor-plan-three.utils';
import { visualDevicePosition } from '../../../shared/utils/floor-plan-device.utils';

const ROOM_HEIGHT = .75;

@Component({
  selector: 'resq-three-floor-viewer',
  standalone: true,
  template: '<div #host class="viewer" role="application" aria-label="Interactive 3D floor view"><div #tooltip class="device-tooltip"></div></div>',
  styles: [':host{display:block;height:366px;background:linear-gradient(180deg,#f5f8fc,#e8eef5)}.viewer{position:relative;width:100%;height:100%;cursor:grab}.viewer:active{cursor:grabbing}canvas{display:block;width:100%;height:100%}.device-tooltip{display:none;position:absolute;z-index:3;max-width:240px;padding:7px 9px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;color:#344054;box-shadow:0 6px 18px rgb(16 24 40 / 18%);font:600 11px/1.4 system-ui;pointer-events:none;white-space:nowrap}'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreeFloorViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) floor!: Floor;
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
  private readonly roomMeshes = new Map<string, THREE.Mesh>();
  private readonly deviceMeshes: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  ngAfterViewInit(): void {
    this.initialize();
    this.rebuildFloor();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.scene) return;
    if (changes['floor']) this.rebuildFloor();
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

  private rebuildFloor(): void {
    if (!this.scene || !this.floor) return;
    this.disposeSceneObjects();
    this.roomMeshes.clear();
    this.deviceMeshes.length = 0;

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(20.5, .18, 10.5),
      new THREE.MeshStandardMaterial({ color: 0xdbe4ee, roughness: .86, metalness: .04 }),
    );
    slab.position.y = -.12;
    slab.receiveShadow = true;
    slab.userData['generated'] = true;
    this.scene.add(slab);

    const grid = new THREE.GridHelper(20, 20, 0xb8c8d8, 0xd9e2eb);
    grid.scale.z = .5;
    grid.position.y = -.02;
    grid.userData['generated'] = true;
    this.scene.add(grid);

    for (const space of this.floor.spaces) {
      if (space.polygon.length < 3) continue;
      const shape = floorPlanShape(space.polygon);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: ROOM_HEIGHT, bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      const material = this.roomMaterial(space.status, space.id === this.selectedSpaceId);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { generated: true, spaceId: space.id, status: space.status };
      this.roomMeshes.set(space.id, mesh);
      this.scene.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: space.id === this.selectedSpaceId ? 0x1570ef : 0x52677d, transparent: true, opacity: .7 }),
      );
      edges.userData = { generated: true, spaceId: space.id };
      this.scene.add(edges);

      for (const [deviceIndex, device] of space.devices.entries()) {
        const visualPosition = visualDevicePosition(space.devices, deviceIndex);
        if (!visualPosition) continue;
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(.13, 18, 12),
          new THREE.MeshStandardMaterial({ color: this.deviceColor(device.status), roughness: .5 }),
        );
        const world = floorPlanToWorldCoordinates(visualPosition);
        marker.position.set(world.x, ROOM_HEIGHT + .18, world.z);
        marker.castShadow = true;
        marker.userData = {
          generated: true,
          deviceId: device.id,
          spaceId: space.id,
          tooltip: `${device.displayName || device.name} · ${device.name} · ${device.code} · ${device.type} · ${device.status} · ${space.name} ${space.roomNumber ?? ''}`,
        };
        this.deviceMeshes.push(marker);
        this.scene.add(marker);
      }
    }
  }

  private updateSelection(): void {
    for (const mesh of this.roomMeshes.values()) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const status = mesh.userData['status'] as RiskStatus;
      const selected = mesh.userData['spaceId'] === this.selectedSpaceId;
      const replacement = this.roomMaterial(status, selected);
      material.color.copy(replacement.color);
      material.emissive.copy(replacement.emissive);
      material.opacity = replacement.opacity;
      replacement.dispose();
    }
  }

  private roomMaterial(status: RiskStatus, selected: boolean): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: selected ? 0x72aaf5 : riskColor(status),
      emissive: selected ? 0x0b4ea8 : 0x000000,
      emissiveIntensity: selected ? .28 : 0,
      transparent: true,
      opacity: selected ? .92 : .76,
      roughness: .72,
      metalness: .03,
      side: THREE.DoubleSide,
    });
  }

  private deviceColor(status: DeviceStatus): number {
    return ({ Online: 0x1570ef, Warning: 0xf79009, Critical: 0xf04438, Offline: 0x98a2b3 })[status];
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.camera || !this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const deviceHit = this.raycaster.intersectObjects(this.deviceMeshes, false)[0];
    const deviceId = deviceHit?.object.userData['deviceId'] as string | undefined;
    if (deviceId) { this.zone.run(() => this.deviceSelected.emit(deviceId)); return; }
    const hit = this.raycaster.intersectObjects([...this.roomMeshes.values()], false)[0];
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
