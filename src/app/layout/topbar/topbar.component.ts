import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { SearchResult } from '../../core/models/resq.models';
import { AlertService, SearchService } from '../../core/services/data.services';

@Component({
  selector: 'resq-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search">
      <mat-icon>search</mat-icon>
      <input aria-label="Global search" placeholder="Search spaces, devices..." [(ngModel)]="query" (ngModelChange)="search($event)" />
      @if (results().length) {
        <div class="search-results">
          @for (group of groupedResults(); track group.type) {
            <b>{{ group.type }}s</b>
            @for (item of group.items; track item.id) {
              <a [routerLink]="item.route" (click)="clearSearch()"><span>{{ item.title }}</span><small>{{ item.subtitle }}</small></a>
            }
          }
        </div>
      }
    </div>

    <div class="notification-wrap">
      <button type="button" class="icon-button" aria-label="Notifications" title="Notifications" (click)="notificationsOpen.update(value => !value)">
        <mat-icon>notifications_none</mat-icon>
        @if (activeAlerts().length) { <i></i> }
      </button>
      @if (notificationsOpen()) {
        <div class="notifications">
          <h3>Notifications <span>{{ activeAlerts().length }}</span></h3>
          @for (alert of activeAlerts().slice(0, 3); track alert.id) {
            <a [routerLink]="'/alerts/' + alert.id"><i [class.critical]="alert.severity === 'Critical'">!</i><div><b>{{ alert.title }}</b><small>{{ alert.severity }} · recently</small></div></a>
          }
          <a class="view-all" routerLink="/alerts">View all alerts →</a>
        </div>
      }
    </div>

    <div class="user" title="User profile">
      <span>JD</span><div><b>John Doe</b><small>Administrator</small></div><mat-icon>expand_more</mat-icon>
    </div>
  `,
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  private readonly searchService = inject(SearchService);
  private readonly alertService = inject(AlertService);

  @Output() readonly menuClick = new EventEmitter<void>();
  readonly results = signal<SearchResult[]>([]);
  readonly notificationsOpen = signal(false);
  readonly activeAlerts = this.alertService.activeAlerts;
  query = '';

  search(query: string): void { this.searchService.search(query).subscribe(items => this.results.set(items)); }
  groupedResults(): Array<{ type: string; items: SearchResult[] }> {
    return ['Space', 'Device', 'Building'].map(type => ({ type, items: this.results().filter(item => item.type === type) })).filter(group => group.items.length);
  }
  clearSearch(): void { this.query = ''; this.results.set([]); }
}
