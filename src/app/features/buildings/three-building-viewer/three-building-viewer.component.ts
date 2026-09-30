import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Building, RiskStatus } from '../../../core/models/resq.models';
import { floorPlanShape, floorPlanToWorldCoordinates, riskColor } from '../../../shared/three/floor-plan-three.utils';

const ROOM_HEIGHT = .72;
const FLOOR_GAP = 1.25;
const NEUTRAL_COLOR = 0xb8c2cc;

@Component({
  selector: 'resq-three-building-viewer',
  standalone: true,
  template: '<div #host class="viewer" role="img" [attr.aria-label]="building.name + \' 3D floor overview\'"></div>',
  styles: [`
    :host { display: block; width: 100%; height: 500px; min-height: 420px; overflow: hidden; border-radius: 10px; background: linear-gradient(180deg, #f7f9fc, #eaf0f6); }
    .viewer { width: 100%; height: 100%; cursor: grab; }
    .viewer:active { cursor: grabbing; }
    canvas { display: block; width: 100%; height: 100%; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThreeBuildingViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) building!: Building;
  @Input() hoveredFloorId?: string;
  @ViewChild('host', { static: true }) private host!: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private resizeObserver?: ResizeObserver;
  private animationFrame = 0;
  private readonly roomMeshes: Array<{ floorId: string; status: RiskStatus; mesh: THREE.Mesh }> = [];

  ngAfterViewInit(): void {
    this.initialize();
    this.rebuildBuilding();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.scene) return;
    if (changes['building']) this.rebuildBuilding();
    else if (changes['hoveredFloorId']) this.updateFloorColors();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.disposeGeneratedObjects();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
  }

  private initialize(): void {
    const host = this.host.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f7fb);
    this.camera = new THREE.PerspectiveCamera(40, host.clientWidth / Math.max(host.clientHeight, 1), .1, 200);
    this.camera.position.set(12, 10, 14);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.02;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 70;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7f92a7, 1.7));
    const directional = new THREE.DirectionalLight(0xffffff, 2.4);
    directional.position.set(10, 18, 12);
    directional.castShadow = true;
    directional.shadow.mapSize.set(2048, 2048);
    this.scene.add(directional);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.zone.runOutsideAngular(() => this.animate());
  }

  private rebuildBuilding(): void {
    if (!this.scene || !this.building) return;
    this.disposeGeneratedObjects();
    this.roomMeshes.length = 0;

    const floors = [...this.building.floors].sort((a, b) => a.level - b.level);
    floors.forEach((floor, floorIndex) => {
      const validSpaces = floor.spaces.filter(space => space.polygon.length >= 3);
      if (!validSpaces.length) return;
      const baseY = floorIndex * FLOOR_GAP;
      const points = validSpaces.flatMap(space => space.polygon).map(floorPlanToWorldCoordinates);
      const minX = Math.min(...points.map(point => point.x));
      const maxX = Math.max(...points.map(point => point.x));
      const minZ = Math.min(...points.map(point => point.z));
      const maxZ = Math.max(...points.map(point => point.z));
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(maxX - minX + .35, .1, maxZ - minZ + .35),
        new THREE.MeshStandardMaterial({ color: 0xe4e9ef, roughness: .88 }),
      );
      slab.position.set((minX + maxX) / 2, baseY - .08, (minZ + maxZ) / 2);
      slab.receiveShadow = true;
      slab.userData['generated'] = true;
      this.scene!.add(slab);

      for (const space of validSpaces) {
        const geometry = new THREE.ExtrudeGeometry(floorPlanShape(space.polygon), { depth: ROOM_HEIGHT, bevelEnabled: false });
        geometry.rotateX(-Math.PI / 2);
        const material = new THREE.MeshStandardMaterial({
          color: NEUTRAL_COLOR,
          transparent: true,
          opacity: .86,
          roughness: .72,
          metalness: .03,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = baseY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { generated: true, floorId: floor.id, spaceId: space.id, status: space.status };
        this.roomMeshes.push({ floorId: floor.id, status: space.status, mesh });
        this.scene!.add(mesh);

        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: 0x607286, transparent: true, opacity: .62 }),
        );
        edges.position.y = baseY;
        edges.userData['generated'] = true;
        this.scene!.add(edges);
      }
    });

    this.updateFloorColors();
    this.fitCamera();
  }

  private updateFloorColors(): void {
    for (const room of this.roomMeshes) {
      const material = room.mesh.material as THREE.MeshStandardMaterial;
      const active = room.floorId === this.hoveredFloorId;
      material.color.setHex(active ? riskColor(room.status) : NEUTRAL_COLOR);
      material.emissive.setHex(active ? riskColor(room.status) : 0x000000);
      material.emissiveIntensity = active ? .08 : 0;
      material.opacity = active ? .94 : .78;
    }
  }

  private fitCamera(): void {
    if (!this.scene || !this.camera || !this.controls) return;
    const generated = this.scene.children.filter(child => child.userData['generated']);
    if (!generated.length) return;
    const bounds = new THREE.Box3();
    for (const object of generated) bounds.expandByObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y * 2, size.z);
    const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.25;
    this.camera.position.set(center.x + distance * .72, center.y + distance * .58, center.z + distance * .8);
    this.camera.near = Math.max(.1, distance / 100);
    this.camera.far = distance * 10;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();
  }

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

  private disposeGeneratedObjects(): void {
    if (!this.scene) return;
    for (const object of this.scene.children.filter(child => child.userData['generated'])) {
      object.traverse(child => {
        const renderable = child as THREE.Mesh;
        renderable.geometry?.dispose();
        const materials = Array.isArray(renderable.material) ? renderable.material : renderable.material ? [renderable.material] : [];
        materials.forEach(material => material.dispose());
      });
      this.scene.remove(object);
    }
  }
}
