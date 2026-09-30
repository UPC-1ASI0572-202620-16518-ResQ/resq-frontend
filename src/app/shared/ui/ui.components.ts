import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'resq-status-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge status-' + status.toLowerCase()"
    ><span class="dot"></span>{{ label || status }}</span
  >`,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 9px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      .status-normal,
      .status-online,
      .status-resolved,
      .status-active,
      .status-powered {
        color: #067647;
        background: #ecfdf3;
      }
      .status-warning,
      .status-acknowledged,
      .status-inprogress,
      .status-pending_calibration,
      .status-calibration_required {
        color: #b54708;
        background: #fffaeb;
      }
      .status-critical,
      .status-new,
      .status-open {
        color: #b42318;
        background: #fef3f2;
      }
      .status-offline,
      .status-info,
      .status-inactive,
      .status-retired,
      .status-unpowered {
        color: #475467;
        background: #f2f4f7;
      }
    `,
  ],
})
export class StatusBadgeComponent {
  @Input({ required: true }) status = 'Normal';
  @Input() label = '';
}

@Component({
  selector: 'resq-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article class="kpi">
    <div class="icon" [class]="tone">{{ icon }}</div>
    <div>
      <strong>{{ value }}</strong
      ><span>{{ label }}</span>
    </div>
    <em [class.down]="trend.startsWith('↓')">{{ trend }}</em>
  </article>`,
  styles: [
    `
      .kpi {
        min-height: 84px;
        padding: 14px 16px;
        background: #fff;
        border: 1px solid var(--resq-border);
        border-radius: 11px;
        display: grid;
        grid-template-columns: 44px 1fr auto;
        align-items: center;
        gap: 12px;
        box-shadow: 0 1px 2px #10182808;
      }
      .icon {
        width: 42px;
        height: 42px;
        border-radius: 9px;
        background: #eaf2ff;
        color: #1268e8;
        display: grid;
        place-items: center;
        font-size: 20px;
      }
      .icon.green {
        background: #eafaf2;
        color: #12b76a;
      }
      .icon.red {
        background: #fff0f1;
        color: #f04438;
      }
      .icon.amber {
        background: #fff7e8;
        color: #f79009;
      }
      strong {
        display: block;
        color: #101828;
        font-size: 24px;
        line-height: 1.1;
      }
      span {
        display: block;
        margin-top: 4px;
        color: #667085;
        font-size: 13px;
      }
      em {
        align-self: start;
        color: #12b76a;
        font-size: 12px;
        font-style: normal;
        font-weight: 700;
      }
      .down {
        color: #f04438;
      }
    `,
  ],
})
export class KpiCardComponent {
  @Input() icon = '▦';
  @Input() value: string | number = 0;
  @Input() label = '';
  @Input() trend = '';
  @Input() tone = '';
}

@Component({
  selector: 'resq-line-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas baseChart [data]="data" [options]="options" type="line"></canvas>`,
  styles: [
    `
      :host {
        display: block;
        height: 190px;
      }
      canvas {
        max-height: 190px;
      }
    `,
  ],
})
export class LineChartComponent {
  @Input() labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'];
  @Input() values: number[] = [];
  @Input() datasetLabel = 'Temperature';
  @Input() unit = '';
  @Input() multi = false;
  get data(): ChartConfiguration<'line'>['data'] {
    return {
      labels: this.labels,
      datasets: this.multi
        ? [
            {
              label: 'Temperature (°C)',
              data: [19, 20, 21, 25, 29, 31, 28],
              borderColor: '#1570ef',
              backgroundColor: '#1570ef18',
              tension: 0.4,
              fill: true,
              pointRadius: 2,
            },
            {
              label: 'Smoke (ppm)',
              data: [80, 92, 88, 130, 210, 330, 260],
              borderColor: '#f04438',
              backgroundColor: 'transparent',
              tension: 0.4,
              pointRadius: 2,
            },
            {
              label: 'Gas (ppm)',
              data: [140, 170, 150, 250, 420, 480, 390],
              borderColor: '#fdb022',
              backgroundColor: 'transparent',
              tension: 0.4,
              pointRadius: 2,
            },
          ]
        : [
            {
              label: `${this.datasetLabel}${this.unit ? ` (${this.unit})` : ''}`,
              data: this.values.length ? this.values : [18, 20, 19, 25, 27, 31, 28],
              borderColor: '#1570ef',
              backgroundColor: '#1570ef18',
              fill: true,
              tension: 0.35,
              pointRadius: this.values.length > 12 ? 0 : 2,
              pointHoverRadius: 4,
            },
          ],
    };
  }
  get options(): ChartConfiguration<'line'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${this.datasetLabel}: ${context.parsed.y}${this.unit ? ` ${this.unit}` : ''}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#667085',
            font: { size: 11 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 7,
          },
        },
        y: {
          border: { display: false },
          grid: { color: '#eaecf0' },
          title: { display: !!this.unit, text: this.unit, color: '#667085' },
          ticks: { color: '#667085', font: { size: 11 } },
        },
      },
    };
  }
}

@Component({
  selector: 'resq-doughnut-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="wrap">
    <canvas baseChart [data]="data" [options]="options" type="doughnut"></canvas>
    <div class="center"><b>142</b><span>Devices</span></div>
  </div>`,
  styles: [
    `
      .wrap {
        height: 154px;
        position: relative;
      }
      .center {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        text-align: center;
        pointer-events: none;
      }
      .center b {
        font-size: 22px;
      }
      .center span {
        font-size: 12px;
        color: #667085;
      }
    `,
  ],
})
export class DoughnutChartComponent {
  readonly data: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Online', 'Warning', 'Critical', 'Offline'],
    datasets: [
      {
        data: [118, 12, 6, 6],
        backgroundColor: ['#12b76a', '#fdb022', '#f04438', '#98a2b3'],
        borderWidth: 0,
        hoverOffset: 2,
      },
    ],
  };
  readonly options: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: { legend: { display: false } },
  };
}

@Component({
  selector: 'resq-bar-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas baseChart [data]="data" [options]="options" type="bar"></canvas>`,
  styles: [
    `
      :host {
        display: block;
        height: 210px;
      }
      canvas {
        max-height: 210px;
      }
    `,
  ],
})
export class BarChartComponent {
  @Input() labels = ['Chemistry Lab', 'Server Room', 'Storage', 'Office 208', 'Classroom 205'];
  @Input() values = [18, 12, 9, 6, 4];
  @Input() color = '#1570ef';
  get data(): ChartConfiguration<'bar'>['data'] {
    return {
      labels: this.labels,
      datasets: [
        {
          label: 'Alerts',
          data: this.values,
          backgroundColor: this.color,
          borderRadius: 4,
          barThickness: 20,
        },
      ],
    };
  }
  readonly options: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 12 }, color: '#667085' } },
      y: {
        border: { display: false },
        grid: { color: '#eaecf0' },
        ticks: { font: { size: 12 }, color: '#667085' },
      },
    },
  };
}

@Component({
  selector: 'resq-empty-state',
  standalone: true,
  template: `<div class="empty">
    <span>◇</span><b>{{ title }}</b>
    <p>{{ message }}</p>
  </div>`,
  styles: [
    `
      .empty {
        text-align: center;
        padding: 36px;
        color: #98a2b3;
      }
      .empty span {
        font-size: 28px;
      }
      .empty b {
        display: block;
        color: #344054;
        margin: 8px;
      }
      .empty p {
        margin: 0;
        font-size: 13px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() title = 'Nothing here yet';
  @Input() message = 'Try adjusting your filters.';
}

@Component({
  selector: 'resq-loading-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="loading" role="status">
    <span aria-hidden="true"></span><b>{{ message }}</b>
  </div>`,
  styles: [
    `
      .loading {
        min-height: 180px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: #475467;
        font-size: 13px;
      }
      .loading span {
        width: 22px;
        height: 22px;
        border: 3px solid #dbe7f5;
        border-top-color: #1570ef;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .loading span {
          animation-duration: 2s;
        }
      }
    `,
  ],
})
export class LoadingStateComponent {
  @Input() message = 'Loading...';
}
