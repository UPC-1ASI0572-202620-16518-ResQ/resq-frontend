import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Device } from '../../core/models/resq.models';
import { capabilityCategory } from '../../core/models/device-domain';
import { LineChartComponent } from './ui.components';

@Component({
  selector: 'resq-sensor-history',
  standalone: true,
  imports: [FormsModule, LineChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<label
      >History sensor<select [ngModel]="selectedId()" (ngModelChange)="selectedId.set($event)">
        <option value="">Select a sensor</option>
        @for (device of sensors(); track device.id) {
          <option [value]="device.id">{{ device.displayName || device.name }}</option>
        }
      </select></label
    >
    @if (readings().length) {
      <resq-line-chart
        [labels]="labels()"
        [values]="values()"
        [datasetLabel]="selected()?.name || 'Measurement'"
        [unit]="readings()[0].unit"
      />
    } @else {
      <p>No measurements recorded for this sensor.</p>
    }`,
  styles: [
    `
      :host {
        display: block;
      }
      label {
        display: grid;
        gap: 6px;
        color: #667085;
        font-size: 12px;
        margin-bottom: 14px;
      }
      select {
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        min-height: 38px;
        background: white;
        color: #344054;
        max-width: 100%;
      }
      p {
        color: #667085;
        font-size: 12px;
      }
    `,
  ],
})
export class SensorHistoryComponent {
  readonly devices = input<Device[]>([]);
  readonly selectedId = signal('');
  readonly sensors = computed(() =>
    this.devices().filter((device) =>
      device.capabilities.some((cap) => capabilityCategory(cap) === 'SENSOR'),
    ),
  );
  readonly selected = computed(
    () => this.sensors().find((device) => device.id === this.selectedId()) ?? this.sensors()[0],
  );
  readonly readings = computed(() => this.selected()?.readings.slice(-24) ?? []);
  readonly values = computed(() => this.readings().map((reading) => reading.value));
  readonly labels = computed(() =>
    this.readings().map((reading) =>
      reading.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ),
  );
}
