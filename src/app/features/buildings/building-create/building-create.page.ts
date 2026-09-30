import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Building, Floor } from '../../../core/models/resq.models';
import { BuildingStoreService } from '../../../core/services/building-store.service';

type WizardStep = 1 | 2 | 3;
type FloorFormGroup = FormGroup<{
  id: FormControl<string>;
  level: FormControl<number>;
  name: FormControl<string>;
}>;

@Component({
  selector: 'resq-building-create-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatSnackBarModule],
  templateUrl: './building-create.page.html',
  styleUrl: './building-create.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildingCreatePage implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly buildingStore = inject(BuildingStoreService);
  private originalBuilding?: Building;

  readonly isEditMode = signal(false);
  readonly currentStep = signal<WizardStep>(1);
  readonly imagePreview = signal<string | undefined>(undefined);
  readonly imageError = signal<string | undefined>(undefined);

  readonly buildingForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    numberOfFloors: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(20)] }),
  });
  readonly floorsForm = new FormArray<FloorFormGroup>([]);

  get floorControls(): FloorFormGroup[] { return this.floorsForm.controls; }

  ngOnInit(): void {
    const buildingId = this.route.snapshot.paramMap.get('buildingId');
    if (!buildingId) return;
    const building = this.buildingStore.getBuilding(buildingId);
    if (!building) { void this.router.navigate(['/buildings']); return; }
    this.originalBuilding = building;
    this.isEditMode.set(true);
    this.buildingForm.setValue({
      name: building.name,
      address: building.address,
      description: building.description ?? '',
      numberOfFloors: building.floors.length,
    });
    this.imagePreview.set(building.imageUrl);
    [...building.floors].sort((a, b) => a.level - b.level).forEach(floor => {
      this.floorsForm.push(this.createFloorForm(floor.level, floor.name, floor.id));
    });
  }

  next(): void {
    if (this.currentStep() === 1) {
      if (this.buildingForm.invalid) { this.buildingForm.markAllAsTouched(); return; }
      this.syncFloors();
      this.currentStep.set(2);
      return;
    }
    if (this.currentStep() === 2) {
      if (this.floorsForm.invalid) { this.floorsForm.markAllAsTouched(); return; }
      this.currentStep.set(3);
    }
  }

  previous(): void {
    const step = this.currentStep();
    if (step > 1) this.currentStep.set((step - 1) as WizardStep);
  }

  goToStep(step: WizardStep): void {
    if (step < this.currentStep()) this.currentStep.set(step);
  }

  private syncFloors(): void {
    const count = Math.min(Math.max(Number(this.buildingForm.controls.numberOfFloors.value), 1), 20);
    while (this.floorsForm.length < count) {
      const level = this.floorsForm.length + 1;
      this.floorsForm.push(this.createFloorForm(level));
    }
    while (this.floorsForm.length > count) this.floorsForm.removeAt(this.floorsForm.length - 1);
    this.renumberFloors();
  }

  private createFloorForm(level: number, name = `Floor ${level}`, id = ''): FloorFormGroup {
    return new FormGroup({
      id: new FormControl(id, { nonNullable: true }),
      level: new FormControl(level, { nonNullable: true }),
      name: new FormControl(name, { nonNullable: true, validators: [Validators.required] }),
    });
  }

  addFloor(): void {
    const level = this.floorsForm.length + 1;
    if (level > 20) { this.snackBar.open('A maximum of 20 floors is allowed.', 'Close', { duration: 2500 }); return; }
    this.floorsForm.push(this.createFloorForm(level));
    this.buildingForm.controls.numberOfFloors.setValue(this.floorsForm.length);
  }

  removeFloor(index: number): void {
    if (this.floorsForm.length <= 1) return;
    const control = this.floorControls[index];
    const existing = this.originalBuilding?.floors.find(floor => floor.id === control.controls.id.value);
    const devices = existing?.spaces.reduce((total, space) => total + space.devices.length, 0) ?? 0;
    if (existing && !window.confirm(`Delete ${existing.name}?\n\nThis floor contains ${existing.spaces.length} spaces and ${devices} devices.\nIts floor plan configuration will also be removed.`)) return;
    this.floorsForm.removeAt(index);
    this.renumberFloors();
    this.buildingForm.controls.numberOfFloors.setValue(this.floorsForm.length);
  }

  private renumberFloors(): void {
    this.floorControls.forEach((floor, index) => {
      const level = index + 1;
      if (/^Floor \d+$/.test(floor.controls.name.value)) floor.controls.name.setValue(`Floor ${level}`);
      floor.controls.level.setValue(level);
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.processImage(file);
  }

  onImageDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processImage(file);
  }

  private processImage(file: File): void {
    this.imageError.set(undefined);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { this.imageError.set('Use a JPG, PNG or WEBP image.'); return; }
    if (file.size > 5 * 1024 * 1024) { this.imageError.set('The image must be smaller than 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') this.imagePreview.set(reader.result); };
    reader.onerror = () => this.imageError.set('The selected image could not be loaded.');
    reader.readAsDataURL(file);
  }

  removeImage(): void { this.imagePreview.set(undefined); this.imageError.set(undefined); }

  createBuilding(): void {
    if (this.buildingForm.invalid) { this.buildingForm.markAllAsTouched(); this.currentStep.set(1); return; }
    if (this.floorsForm.invalid) { this.floorsForm.markAllAsTouched(); this.currentStep.set(2); return; }

    const buildingName = this.buildingForm.controls.name.value.trim();
    const buildingId = this.originalBuilding?.id ?? this.createUniqueBuildingId(buildingName);
    const floors: Floor[] = this.floorControls.map(control => {
      const level = control.controls.level.value;
      const floorId = control.controls.id.value || `${buildingId}-f${level}`;
      const existing = this.originalBuilding?.floors.find(floor => floor.id === floorId);
      return {
        ...(existing ?? {}),
        id: floorId,
        buildingId,
        name: control.controls.name.value.trim(),
        level,
        spaces: existing?.spaces ?? [],
        status: existing?.status ?? 'Normal',
        planElements: existing?.planElements ?? [],
        planImageUrl: existing?.planImageUrl,
        planConfigured: existing?.planConfigured ?? false,
      };
    });
    const building: Building = {
      id: buildingId,
      name: buildingName,
      address: this.buildingForm.controls.address.value.trim(),
      description: this.buildingForm.controls.description.value.trim() || undefined,
      imageUrl: this.imagePreview(),
      floors,
      status: this.originalBuilding?.status ?? 'Normal',
    };
    if (this.isEditMode()) this.buildingStore.updateBuilding(building);
    else this.buildingStore.createBuilding(building);
    this.snackBar.open(this.isEditMode() ? 'Building updated successfully' : 'Building created successfully', 'Close', {
      duration: 3000, horizontalPosition: 'right', verticalPosition: 'top',
    });
    void this.router.navigate(['/buildings', building.id]);
  }

  private createUniqueBuildingId(name: string): string {
    const base = this.slugify(name) || 'building';
    if (!this.buildingStore.getBuilding(base)) return base;
    let suffix = 2;
    while (this.buildingStore.getBuilding(`${base}-${suffix}`)) suffix++;
    return `${base}-${suffix}`;
  }

  private slugify(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
}
