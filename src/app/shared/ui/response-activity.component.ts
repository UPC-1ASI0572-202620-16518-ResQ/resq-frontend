import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BuildingStoreService } from '../../core/services/building-store.service';
import { StatusBadgeComponent } from './ui.components';

@Component({
  selector: 'resq-response-activity',
  standalone: true,
  imports: [DatePipe, RouterLink, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="activity">
    <header>
      <h3>Response activity</h3>
      <small>Session measurements and simulation</small>
    </header>
    @for (event of events(); track event.id) {
      <a [routerLink]="['/devices', event.deviceId]"
        ><div>
          <b>{{ event.sensor }} · {{ event.value }} {{ event.unit }}</b
          ><small
            >{{ event.message }} · {{ event.createdAt | date: 'shortTime' }} ·
            {{ event.simulated ? 'Simulation' : 'Measurement' }}</small
          ><small>{{ event.targets.length }} response targets</small>
        </div>
        <resq-status-badge [status]="event.risk"
      /></a>
    } @empty {
      <p>No response events in this session.</p>
    }
  </section>`,
  styles: [
    `
      .activity {
        background: white;
        border: 1px solid #e4e7ec;
        border-radius: 12px;
        padding: 18px;
        margin: 16px 0;
        color: #344054;
      }
      .activity h3 {
        margin: 0;
        font-size: 16px;
      }
      .activity small {
        display: block;
        color: #667085;
        font-size: 12px;
      }
      .activity a {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid #eaecf0;
        text-decoration: none;
        color: inherit;
      }
      .activity a:last-child {
        border: 0;
      }
      .activity b {
        font-size: 13px;
      }
      .activity p {
        font-size: 12px;
        color: #667085;
      }
    `,
  ],
})
export class ResponseActivityComponent {
  readonly spaceId = input('');
  readonly deviceId = input('');
  readonly store = inject(BuildingStoreService);
  readonly events = computed(() =>
    this.store
      .events()
      .filter(
        (event) =>
          (!this.spaceId() || event.spaceId === this.spaceId()) &&
          (!this.deviceId() ||
            event.deviceId === this.deviceId() ||
            event.targets.some((target) => target.deviceId === this.deviceId())),
      )
      .slice(0, 10),
  );
}
