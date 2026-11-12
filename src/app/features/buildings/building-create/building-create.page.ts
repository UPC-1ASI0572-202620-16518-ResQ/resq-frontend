import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, concatMap, from, of, reduce, switchMap } from 'rxjs';
import { Building } from '../../../core/models/resq.models';
import { BuildingFacade } from '../data-access/building.facade';
import { mapCatalogBuildingToPresentation } from '../building-legacy.mapper';

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
  private readonly buildings = inject(BuildingFacade);
  private originalBuilding?: Building;

  readonly isEditMode = signal(false);
  readonly isSaving = signal(false);
  readonly currentStep = signal<WizardStep>(1);

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
    this.buildings.loadBuilding(buildingId).subscribe({
      next: (result) => {
        if (!result) { void this.router.navigate(['/buildings']); return; }
        const building = mapCatalogBuildingToPresentation(result.building);
        this.originalBuilding = building;
        this.isEditMode.set(true);
        this.buildingForm.setValue({
          name: building.name,
          address: building.address,
          description: building.description ?? '',
          numberOfFloors: Math.max(1, building.floors.length),
        });
        [...building.floors].sort((a, b) => a.level - b.level).forEach((floor) => {
          this.floorsForm.push(this.createFloorForm(floor.level, floor.name, floor.id));
        });
      },
      error: () => void this.router.navigate(['/buildings']),
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
    if (existing && !window.confirm(`Remove ${existing.name}?\n\nThe server will reject this operation while the floor has zones, devices or a saved plan.`)) return;
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

  createBuilding(): void {
    if (this.isSaving()) return;
    if (this.buildingForm.invalid) { this.buildingForm.markAllAsTouched(); this.currentStep.set(1); return; }
    if (this.floorsForm.invalid) { this.floorsForm.markAllAsTouched(); this.currentStep.set(2); return; }

    const name = this.buildingForm.controls.name.value.trim();
    const address = parseAddress(this.buildingForm.controls.address.value);
    if (!address) {
      this.currentStep.set(1);
      this.snackBar.open('Enter address as: street, district, city, country code.', 'Close', { duration: 3500 });
      return;
    }
    const description = this.buildingForm.controls.description.value.trim() || undefined;
    this.isSaving.set(true);
    const floors = this.floorControls.map(control => ({
      label: control.controls.name.value.trim(),
      level: control.controls.level.value,
    }));
    const operation = this.isEditMode()
      ? this.buildings.updateBuildingDetails({ name, description, address }).pipe(
          switchMap(result => this.synchronizeFloors(result, floors)),
        )
      : this.buildings.registerBuilding({
          buildingCode: `BLDG_${this.slugify(name).replace(/-/g, '_').toUpperCase()}_${Date.now().toString(36).toUpperCase()}`.slice(0, 64),
          name,
          description,
          address,
          floors,
        });
    operation.subscribe({
      next: (result) => {
        this.snackBar.open(
          this.isEditMode() ? 'Building and floors updated successfully.' : 'Building and floors created successfully.',
          'Close',
          { duration: 4000, horizontalPosition: 'right', verticalPosition: 'top' },
        );
        void this.router.navigate(['/buildings', result.building.id]);
      },
      error: (error: { message?: string; status?: number }) => {
        this.isSaving.set(false);
        const message = error.status === 409
          ? 'The building changed or a floor is still in use. Reload and try again.'
          : error.message ?? 'Building or floors could not be saved.';
        this.snackBar.open(message, 'Close', { duration: 5000 });
      },
    });
  }

  private synchronizeFloors(
    initial: import('../data-access/building.gateway').VersionedBuildingCatalogRecord,
    desired: Array<{ label: string; level: number }>,
  ): Observable<import('../data-access/building.gateway').VersionedBuildingCatalogRecord> {
    const desiredIds = new Set(this.floorControls.map(control => control.controls.id.value).filter(Boolean));
    const operations: Array<() => Observable<import('../data-access/building.gateway').VersionedBuildingCatalogRecord>> = [];
    for (const floor of initial.building.floors) {
      if (!desiredIds.has(floor.id)) operations.push(() => this.buildings.deleteFloor(floor.id));
    }
    this.floorControls.forEach((control, index) => {
      const resource = desired[index];
      const id = control.controls.id.value;
      const existing = initial.building.floors.find(floor => floor.id === id);
      if (!existing) operations.push(() => this.buildings.addFloor(resource));
      else if (existing.label !== resource.label || existing.level !== resource.level) {
        operations.push(() => this.buildings.updateFloor(id, resource));
      }
    });
    if (!operations.length) return of(initial);
    return from(operations).pipe(
      concatMap(operation => operation()),
      reduce((_, result) => result, initial),
    );
  }

  private slugify(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
}

function parseAddress(value: string): { streetAddress: string; district: string; city: string; countryCode: string } | undefined {
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length < 4) return undefined;
  const countryCode = parts.pop()!.toUpperCase();
  const city = parts.pop()!;
  const district = parts.pop()!;
  const streetAddress = parts.join(', ');
  return streetAddress && district && city && /^[A-Z]{2}$/.test(countryCode)
    ? { streetAddress, district, city, countryCode }
    : undefined;
}
