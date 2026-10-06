import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';

import { MatIconModule } from '@angular/material/icon';

import {
  MatSnackBar,
  MatSnackBarModule,
} from '@angular/material/snack-bar';

import {
  AlertListItem,
  Building,
  RiskStatus,
  riskRank,
} from '../../core/models/resq.models';

import {
  AlertService,
} from '../../core/services/data.services';

import {
  BuildingStoreService,
} from '../../core/services/building-store.service';

import {
  ThreeBuildingViewerComponent,
} from './three-building-viewer/three-building-viewer.component';

import {
  StatusBadgeComponent,
} from '../../shared/ui/ui.components';


/* ============================================================
   BUILDINGS PAGE
============================================================ */

@Component({
  selector: 'resq-buildings-page',

  standalone: true,

  imports: [
    FormsModule,
    RouterLink,
    MatIconModule,
    StatusBadgeComponent,
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `
    <div class="buildings-page">

      <!-- =====================================================
           HEADER
      ====================================================== -->

      <header class="page-header">

        <div class="page-title">

          <h1>
            Buildings
          </h1>

          <p>
            Manage and monitor your connected buildings
          </p>

        </div>


        <label class="search-box">

          <mat-icon>
            search
          </mat-icon>

          <input
            type="search"
            placeholder="Search buildings, addresses..."
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />

        </label>

      </header>


      <!-- =====================================================
           KPI CARDS
      ====================================================== -->

      <section class="kpi-grid">

        <!-- TOTAL BUILDINGS -->

        <article class="kpi-card">

          <span class="kpi-icon blue">
            <mat-icon>
              apartment
            </mat-icon>
          </span>

          <div class="kpi-content">

            <strong>
              {{ buildings().length }}
            </strong>

            <span>
              Total Buildings
            </span>

          </div>

          <small class="trend">
            ↑ 0%
          </small>

        </article>


        <!-- FLOORS -->

        <article class="kpi-card">

          <span class="kpi-icon purple">
            <mat-icon>
              layers
            </mat-icon>
          </span>

          <div class="kpi-content">

            <strong>
              {{ totalFloors() }}
            </strong>

            <span>
              Monitored Floors
            </span>

          </div>

          <small class="trend">
            ↑ 10%
          </small>

        </article>


        <!-- DEVICES -->

        <article class="kpi-card">

          <span class="kpi-icon green">
            <mat-icon>
              sensors
            </mat-icon>
          </span>

          <div class="kpi-content">

            <strong>
              {{ activeDevices() }}
            </strong>

            <span>
              Active Devices
            </span>

          </div>

          <small class="trend">
            ↑ 12%
          </small>

        </article>


        <!-- ALERTED BUILDINGS -->

        <article class="kpi-card">

          <span class="kpi-icon red">
            <mat-icon>
              warning_amber
            </mat-icon>
          </span>

          <div class="kpi-content">

            <strong>
              {{ buildingsWithRecentAlerts() }}
            </strong>

            <span>
              Buildings with Active Alerts
            </span>

          </div>

          <small class="trend">
            ↑ 100%
          </small>

        </article>

      </section>


      <!-- =====================================================
           CONTROLS
      ====================================================== -->

      <section class="controls-bar">

        <div class="view-switcher">

          <button
            type="button"
            [class.active]="viewMode() === 'grid'"
            (click)="viewMode.set('grid')"
          >

            <mat-icon>
              grid_view
            </mat-icon>

            <span>
              Grid View
            </span>

          </button>


          <button
            type="button"
            [class.active]="viewMode() === 'table'"
            (click)="viewMode.set('table')"
          >

            <mat-icon>
              view_list
            </mat-icon>

            <span>
              Table View
            </span>

          </button>

        </div>


        <div class="filters">

          <select
            aria-label="Filter building status"
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
          >

            <option value="All">
              All Status
            </option>

            <option value="Critical">
              Critical
            </option>

            <option value="Warning">
              Warning
            </option>

            <option value="Normal">
              Normal
            </option>

            <option value="Offline">
              Offline
            </option>

          </select>


          <select
            aria-label="Sort buildings"
            [ngModel]="sortMode()"
            (ngModelChange)="sortMode.set($event)"
          >

            <option value="critical">
              Most Critical
            </option>

            <option value="name">
              Name
            </option>

            <option value="devices">
              Most Devices
            </option>

            <option value="alerts">
              Most Alerts
            </option>

          </select>


          <a
            routerLink="/buildings/new"
            class="add-building"
          >

            <mat-icon>
              add
            </mat-icon>

            Add Building

          </a>

        </div>

      </section>


      <!-- =====================================================
           GRID VIEW
      ====================================================== -->

      @if (viewMode() === 'grid') {

        <section class="building-grid">

          @for (
            building of displayedBuildings();
            track building.id
          ) {

            <article
              class="building-card"
              [class.is-critical]="building.status === 'Critical'"
              [class.is-warning]="building.status === 'Warning'"
              [class.is-normal]="building.status === 'Normal'"
            >

              <!-- HEADER -->

              <header class="building-header">

                <div class="building-info">

                  <div class="building-title-row">

                    <span class="building-icon">

                      <mat-icon>
                        apartment
                      </mat-icon>

                    </span>

                    <h2>
                      {{ building.name }}
                    </h2>

                    <resq-status-badge
                      [status]="building.status"
                    />

                  </div>


                  <p class="address">

                    <mat-icon>
                      location_on
                    </mat-icon>

                    {{ building.address }}

                  </p>

                </div>


                <!-- BUILDING IMAGE -->

                <div class="building-photo">

                  @if (building.imageUrl) {

                    <img
                      [src]="building.imageUrl"
                      [alt]="building.name"
                    />

                  } @else {

                    <div class="photo-placeholder">

                      <mat-icon>
                        apartment
                      </mat-icon>

                      <span>
                        No image
                      </span>

                    </div>

                  }

                </div>

              </header>


              <!-- =================================================
                   METRICS
              ================================================== -->

              <section class="building-metrics">

                <!-- FLOORS -->

                <div class="metric">

                  <span class="metric-icon blue">

                    <mat-icon>
                      layers
                    </mat-icon>

                  </span>

                  <div class="metric-data">

                    <strong>
                      {{ building.floors.length }}
                    </strong>

                    <span>
                      Floors
                    </span>

                  </div>

                </div>


                <!-- Active Alerts -->

                <div class="metric">

                  <span class="metric-icon red">

                    <mat-icon>
                      warning_amber
                    </mat-icon>

                  </span>

                  <div class="metric-data">

                    <strong>
                      {{ recentAlertsFor(building) }}
                    </strong>

                    <span>
                      Active Alerts
                    </span>

                  </div>

                </div>


                <!-- SPACES -->

                <div class="metric">

                  <span class="metric-icon blue">

                    <mat-icon>
                      grid_view
                    </mat-icon>

                  </span>

                  <div class="metric-data">

                    <strong>
                      {{ spaceCount(building) }}
                    </strong>

                    <span>
                      Spaces
                    </span>

                  </div>

                </div>


                <!-- CRITICAL SPACES -->

                <div class="metric">

                  <span class="metric-icon red">

                    <mat-icon>
                      error_outline
                    </mat-icon>

                  </span>

                  <div class="metric-data">

                    <strong>
                      {{ criticalSpaces(building) }}
                    </strong>

                    <span>
                      Critical Spaces
                    </span>

                  </div>

                </div>


                <!-- DEVICES -->

                <div class="metric">

                  <span class="metric-icon green">

                    <mat-icon>
                      sensors
                    </mat-icon>

                  </span>

                  <div class="metric-data">

                    <strong>
                      {{ deviceCount(building) }}
                    </strong>

                    <span>
                      Devices
                    </span>

                  </div>

                </div>


                <!-- OFFLINE -->

                <div class="metric">

                  <span class="metric-icon gray">

                    <mat-icon>
                      wifi_off
                    </mat-icon>

                  </span>

                  <div class="metric-data">

                    <strong>
                      {{ offlineDeviceCount(building) }}
                    </strong>

                    <span>
                      Offline Devices
                    </span>

                  </div>

                </div>

              </section>


              <!-- =================================================
                   FLOOR STATUS
              ================================================== -->

              <section class="floor-status">

                <div class="floor-status-title">

                  <mat-icon>
                    stacked_bar_chart
                  </mat-icon>

                  <h3>
                    Floor Status
                  </h3>

                </div>


                <div class="floor-grid">

                  @for (
                    floor of reversedFloors(building);
                    track floor.id
                  ) {

                    <button
                      type="button"
                      class="floor-card"
                      [class.critical]="floor.status === 'Critical'"
                      [class.warning]="floor.status === 'Warning'"
                      [class.normal]="floor.status === 'Normal'"
                      [class.offline]="floor.status === 'Offline'"
                      (click)="
                        openFloor(
                          building,
                          floor.id
                        )
                      "
                    >

                      <strong>
                        {{ floor.name }}
                      </strong>

                      <span>

                        <i
                          class="floor-dot"
                          [class.dot-normal]="floor.status === 'Normal'"
                          [class.dot-warning]="floor.status === 'Warning'"
                          [class.dot-critical]="floor.status === 'Critical'"
                          [class.dot-offline]="floor.status === 'Offline'"
                        ></i>

                        {{ floor.status }}

                      </span>

                    </button>

                  }

                </div>

              </section>


              <!-- =================================================
                   ACTIONS
              ================================================== -->

              <footer class="building-actions">
                @if(building.floors[0];as firstFloor){<a class="secondary-action" [routerLink]="['/buildings',building.id,'floors',firstFloor.id,'editor']"><mat-icon>edit</mat-icon>Edit Plan</a>}

                <a
                  class="primary-action"
                  [routerLink]="[
                    '/buildings',
                    building.id
                  ]"
                >

                  <mat-icon>
                    visibility
                  </mat-icon>

                  View Building

                </a>


                <button
                  type="button"
                  class="secondary-action"
                  (click)="openFloorSelector(building)"
                >
                  <mat-icon>
                    monitoring
                  </mat-icon>

                  Monitor Floor
                </button>

              </footer>

            </article>

          }

        </section>

      }


      <!-- =====================================================
           TABLE VIEW
      ====================================================== -->

      @if (viewMode() === 'table') {

        <section class="table-wrapper">

          <table>

            <thead>

              <tr>
                <th>Building</th>
                <th>Status</th>
                <th>Floors</th>
                <th>Spaces</th>
                <th>Devices</th>
                <th>Active Alerts</th>
                <th>Critical Spaces</th>
                <th>Offline</th>
                <th></th>
              </tr>

            </thead>


            <tbody>

              @for (
                building of displayedBuildings();
                track building.id
              ) {

                <tr>

                  <td>

                    <div class="table-building">

                      @if (building.imageUrl) {

                        <img
                          [src]="building.imageUrl"
                          [alt]="building.name"
                        />

                      } @else {

                        <span class="table-placeholder">

                          <mat-icon>
                            apartment
                          </mat-icon>

                        </span>

                      }


                      <div>

                        <strong>
                          {{ building.name }}
                        </strong>

                        <small>
                          {{ building.address }}
                        </small>

                      </div>

                    </div>

                  </td>


                  <td>

                    <resq-status-badge
                      [status]="building.status"
                    />

                  </td>


                  <td>
                    {{ building.floors.length }}
                  </td>

                  <td>
                    {{ spaceCount(building) }}
                  </td>

                  <td>
                    {{ deviceCount(building) }}
                  </td>

                  <td>
                    {{ recentAlertsFor(building) }}
                  </td>

                  <td>
                    {{ criticalSpaces(building) }}
                  </td>

                  <td>
                    {{ offlineDeviceCount(building) }}
                  </td>

                  <td>

                    <a
                      [routerLink]="[
                        '/buildings',
                        building.id
                      ]"
                    >

                      View

                      <mat-icon>
                        arrow_forward
                      </mat-icon>

                    </a>

                  </td>

                </tr>

              }

            </tbody>

          </table>

        </section>

      }


      <!-- =====================================================
           BOTTOM SECTION
      ====================================================== -->

      <section class="bottom-grid">

        <!-- STATUS SUMMARY -->

        <article class="bottom-card">

          <header class="bottom-header">

            <span class="bottom-icon">

              <mat-icon>
                bar_chart
              </mat-icon>

            </span>

            <div>

              <h2>
                Building Status Summary
              </h2>

              <p>
                Distribution of buildings by current status
              </p>

            </div>

          </header>


          <div class="summary-list">

            @for (
              status of summaryStatuses;
              track status
            ) {

              <div class="summary-row">

                <span class="summary-name">

                  <i
                    class="summary-dot"
                    [class.summary-critical]="status === 'Critical'"
                    [class.summary-warning]="status === 'Warning'"
                    [class.summary-normal]="status === 'Normal'"
                  ></i>

                  {{ status }}

                </span>


                <div class="summary-track">

                  <div
                    class="summary-progress"
                    [class.progress-critical]="status === 'Critical'"
                    [class.progress-warning]="status === 'Warning'"
                    [class.progress-normal]="status === 'Normal'"
                    [style.width.%]="
                      summaryPercentage(status)
                    "
                  ></div>

                </div>


                <strong>
                  {{ summaryCount(status) }}
                </strong>


                <span class="summary-percent">
                  {{ summaryPercentage(status) }}%
                </span>

              </div>

            }

          </div>

        </article>


        <!-- RECENT ACTIVITY -->

        <article class="bottom-card">

          <header class="bottom-header activity-header">

            <div class="activity-heading">

              <span class="bottom-icon">

                <mat-icon>
                  history
                </mat-icon>

              </span>

              <div>

                <h2>
                  Recent Building Activity
                </h2>

                <p>
                  Latest events across all buildings
                </p>

              </div>

            </div>


            <a routerLink="/alerts">

              View all

              <mat-icon>
                arrow_forward
              </mat-icon>

            </a>

          </header>


          <div class="activity-list">

            @for (
              activity of recentBuildingActivity();
              track activity.id
            ) {

              <div class="activity-item">

                <span
                  class="activity-icon"
                  [class.activity-critical]="
                    activity.severity === 'Critical'
                  "
                  [class.activity-warning]="
                    activity.severity === 'Warning'
                  "
                  [class.activity-info]="
                    activity.severity === 'Info'
                  "
                >

                  @if (
                    activity.severity === 'Critical'
                  ) {

                    <mat-icon>
                      error_outline
                    </mat-icon>

                  } @else if (
                    activity.severity === 'Warning'
                  ) {

                    <mat-icon>
                      warning_amber
                    </mat-icon>

                  } @else {

                    <mat-icon>
                      check_circle_outline
                    </mat-icon>

                  }

                </span>


                <div class="activity-content">

                  <strong>
                    {{ activity.title }}
                  </strong>

                  <small>
                    {{ activity.buildingName }}
                    ·
                    {{ activity.address }}
                  </small>

                </div>


                <time>
                  {{ timeAgo(activity.timestamp) }}
                </time>

              </div>

            }

          </div>

        </article>

      </section>


      <!-- =====================================================
           FLOOR SELECTION MODAL
      ====================================================== -->

      @if (floorSelectorBuilding()) {

        <div
          class="dialog-backdrop"
          (click)="closeFloorSelector()"
        >

          <article
            class="floor-dialog"
            (click)="$event.stopPropagation()"
          >

            <header>

              <div class="dialog-title">

                <span class="dialog-icon">

                  <mat-icon>
                    layers
                  </mat-icon>

                </span>

                <div>

                  <h2>
                    Monitor Floor
                  </h2>

                  <p>
                    {{ floorSelectorBuilding()!.name }}
                  </p>

                </div>

              </div>


              <button
                type="button"
                class="close-dialog"
                aria-label="Close floor selection"
                (click)="closeFloorSelector()"
              >

                <mat-icon>
                  close
                </mat-icon>

              </button>

            </header>


            <div class="dialog-floors">

              @for (
                floor of reversedFloors(
                  floorSelectorBuilding()!
                );
                track floor.id
              ) {

                <button
                  type="button"
                  (click)="
                    openFloor(
                      floorSelectorBuilding()!,
                      floor.id
                    )
                  "
                >

                  <div class="dialog-floor-info">

                    <span class="dialog-floor-icon">

                      <mat-icon>
                        layers
                      </mat-icon>

                    </span>


                    <div>

                      <strong>
                        {{ floor.name }}
                      </strong>

                      <small>
                        {{ floor.spaces.length }}
                        spaces
                      </small>

                    </div>

                  </div>


                  <resq-status-badge
                    [status]="floor.status"
                  />


                  <mat-icon class="dialog-arrow">
                    chevron_right
                  </mat-icon>

                </button>

              }

            </div>

          </article>

        </div>

      }

    </div>
  `,

  styles: [`

    :host {
      display: block;
    }


    /* ==========================================================
       GENERAL MAT ICON
    ========================================================== */

    mat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }


    /* ==========================================================
       PAGE
    ========================================================== */

    .buildings-page {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }


    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }


    .page-title h1 {
      margin: 0;
      color: #101828;
      font-size: 24px;
      font-weight: 700;
      line-height: 1.25;
    }


    .page-title p {
      margin: 5px 0 0;
      color: #98a2b3;
      font-size: 13px;
    }


    /* ==========================================================
       SEARCH
    ========================================================== */

    .search-box {
      width: 350px;
      min-height: 44px;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 14px;
      background: #fff;
      border: 1px solid var(--resq-border);
      border-radius: 9px;
    }


    .search-box mat-icon {
      width: 20px;
      height: 20px;
      flex: 0 0 20px;
      color: #667085;
      font-size: 20px;
      line-height: 20px;
    }


    .search-box input {
      width: 100%;
      border: 0;
      outline: none;
      background: transparent;
      color: #344054;
      font-size: 13px;
    }


    .search-box input::placeholder {
      color: #98a2b3;
    }


    /* ==========================================================
       KPI
    ========================================================== */

    .kpi-grid {
      display: grid;
      grid-template-columns:
        repeat(4, minmax(0, 1fr));
      gap: 12px;
    }


    .kpi-card {
      min-height: 92px;
      padding: 16px;
      position: relative;
      display: flex;
      align-items: center;
      gap: 14px;
      background: #fff;
      border: 1px solid var(--resq-border);
      border-radius: 12px;
    }


    .kpi-icon {
      width: 48px;
      height: 48px;
      flex: 0 0 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
    }


    .kpi-icon mat-icon {
      width: 24px;
      height: 24px;
      font-size: 24px;
      line-height: 24px;
    }


    .kpi-icon.blue {
      color: #1570ef;
      background: #eff6ff;
    }


    .kpi-icon.purple {
      color: #7f56d9;
      background: #f4f3ff;
    }


    .kpi-icon.green {
      color: #039855;
      background: #ecfdf3;
    }


    .kpi-icon.red {
      color: #f04438;
      background: #fff1f3;
    }


    .kpi-content strong {
      display: block;
      color: #101828;
      font-size: 25px;
      line-height: 1;
    }


    .kpi-content span {
      display: block;
      margin-top: 5px;
      color: #667085;
      font-size: 13px;
    }


    .trend {
      position: absolute;
      top: 15px;
      right: 16px;
      color: #12b76a;
      font-size: 11px;
      font-weight: 700;
    }


    /* ==========================================================
       CONTROLS
    ========================================================== */

    .controls-bar {
      min-height: 62px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 10px 12px;
      background: #fff;
      border: 1px solid var(--resq-border);
      border-radius: 11px;
    }


    .view-switcher {
      display: flex;
      align-items: center;
      gap: 6px;
    }


    .view-switcher button {
      min-height: 40px;
      padding: 0 16px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: 1px solid var(--resq-border);
      border-radius: 7px;
      background: #fff;
      color: #475467;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }


    .view-switcher mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      line-height: 18px;
    }


    .view-switcher button.active {
      border-color: #1570ef;
      background: #1570ef;
      color: #fff;
    }


    .filters {
      display: flex;
      align-items: center;
      gap: 9px;
    }


    .filters select {
      min-width: 155px;
      height: 40px;
      padding: 0 12px;
      border: 1px solid var(--resq-border);
      border-radius: 7px;
      outline: none;
      background: #fff;
      color: #344054;
      font-size: 13px;
    }


    .add-building {
      min-height: 40px;
      padding: 0 17px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border-radius: 7px;
      background: #1570ef;
      color: #fff;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
    }


    .add-building mat-icon {
      width: 19px;
      height: 19px;
      font-size: 19px;
      line-height: 19px;
    }


    /* ==========================================================
       BUILDING GRID
    ========================================================== */

    .building-grid {
      display: grid;
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(400px, 1fr)
        );
      gap: 16px;
    }


    .building-card {
      min-width: 0;
      overflow: hidden;
      background: #fff;
      border: 1px solid var(--resq-border);
      border-radius: 12px;
    }


    /* ==========================================================
       BUILDING HEADER
    ========================================================== */

    .building-header {
      min-height: 135px;
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        175px;
      gap: 14px;
      padding: 17px 17px 10px;
    }


    .building-header {
      min-height: 135px;
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        175px;
      gap: 14px;
      padding: 17px 17px 10px;
      background: #fff;
    }

    .building-title-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 9px;
    }


    .building-icon {
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: #eff6ff;
      color: #1570ef;
    }


    .building-icon mat-icon {
      width: 21px;
      height: 21px;
      font-size: 21px;
      line-height: 21px;
    }


    .building-title-row h2 {
      margin: 0;
      color: #101828;
      font-size: 17px;
      font-weight: 700;
    }


    .address {
      margin: 10px 0 0 46px;
      display: flex;
      align-items: center;
      gap: 4px;
      color: #7f8da3;
      font-size: 12px;
    }


    .address mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      line-height: 16px;
    }


    /* ==========================================================
       BUILDING IMAGE
    ========================================================== */

    .building-photo {
      width: 175px;
      height: 105px;
      align-self: start;
      overflow: hidden;
      border: 1px solid #eaecf0;
      border-radius: 10px;
      background: #f2f4f7;
    }


    .building-photo img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }


    .photo-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #98a2b3;
      text-align: center;
    }


    .photo-placeholder mat-icon {
      width: 31px;
      height: 31px;
      font-size: 31px;
      line-height: 31px;
    }


    .photo-placeholder span {
      font-size: 11px;
    }


    /* ==========================================================
       BUILDING METRICS
    ========================================================== */

    .building-metrics {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      column-gap: 32px;
      row-gap: 18px;
      padding: 18px 20px;
    }


    .metric {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }


    .metric-icon {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
    }


    .metric-icon mat-icon {
      width: 21px;
      height: 21px;
      font-size: 21px;
      line-height: 21px;
    }


    .metric-icon.blue {
      color: #1570ef;
      background: #eff6ff;
    }


    .metric-icon.green {
      color: #039855;
      background: #ecfdf3;
    }


    .metric-icon.red {
      color: #f04438;
      background: #fff1f3;
    }


    .metric-icon.gray {
      color: #667085;
      background: #f2f4f7;
    }


    .metric-data {
      min-width: 0;
    }


    .metric-data strong {
      display: block;
      color: #101828;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.15;
    }


    .metric-data span {
      display: block;
      margin-top: 4px;
      color: #98a2b3;
      font-size: 12px;
      line-height: 1.25;
    }


    /* ==========================================================
       FLOOR STATUS
    ========================================================== */

    .floor-status {
      margin: 0 14px 14px;
      padding: 12px;
      border: 1px solid #f2f4f7;
      border-radius: 9px;
      background: #f8fafc;
    }


    .floor-status-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }


    .floor-status-title mat-icon {
      width: 17px;
      height: 17px;
      color: #667085;
      font-size: 17px;
      line-height: 17px;
    }


    .floor-status h3 {
      margin: 0;
      color: #475467;
      font-size: 12px;
      font-weight: 700;
    }


    .floor-grid {
      display: grid;
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(92px, 1fr)
        );
      gap: 8px;
    }


    .floor-card {
      min-height: 57px;
      padding: 9px 10px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 6px;
      border: 1px solid #eaecf0;
      border-radius: 7px;
      background: #fff;
      cursor: pointer;
      text-align: left;
    }


    .floor-card:hover {
      border-color: #b2ccff;
    }


    .floor-card.critical {
      border-color: #fda29b;
      background: #fff5f5;
    }


    .floor-card.warning {
      border-color: #fec84b;
      background: #fffaeb;
    }


    .floor-card strong {
      color: #344054;
      font-size: 12px;
    }


    .floor-card span {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #667085;
      font-size: 11px;
    }


    .floor-dot {
      width: 8px;
      height: 8px;
      display: inline-block;
      border-radius: 50%;
    }


    .dot-normal {
      background: #12b76a;
    }


    .dot-warning {
      background: #fdb022;
    }


    .dot-critical {
      background: #f04438;
    }


    .dot-offline {
      background: #98a2b3;
    }


    /* ==========================================================
       ACTIONS
    ========================================================== */

    .building-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px;
      padding: 0 14px 14px;
    }
    .building-actions > a:first-child { grid-column: 1 / -1; }


    .building-actions a,
    .building-actions button {
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border-radius: 7px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }


    .building-actions mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      line-height: 18px;
    }


    .primary-action {
      border: 1px solid #1570ef;
      background: #1570ef;
      color: #fff;
      text-decoration: none;
    }


    .primary-action:hover {
      background: #175cd3;
    }


    .secondary-action {
      border: 1px solid var(--resq-border);
      background: #fff;
      color: #344054;
    }


    .secondary-action:hover {
      background: #f9fafb;
    }


    /* ==========================================================
       TABLE
    ========================================================== */

    .table-wrapper {
      overflow-x: auto;
      background: #fff;
      border: 1px solid var(--resq-border);
      border-radius: 11px;
    }


    table {
      width: 100%;
      min-width: 1100px;
      border-collapse: collapse;
    }


    th,
    td {
      padding: 15px;
      border-bottom: 1px solid #f2f4f7;
      text-align: left;
      font-size: 12px;
    }


    th {
      background: #f9fafb;
      color: #667085;
      font-size: 11px;
      font-weight: 600;
    }


    td {
      color: #344054;
    }


    .table-building {
      display: flex;
      align-items: center;
      gap: 11px;
    }


    .table-building img,
    .table-placeholder {
      width: 52px;
      height: 42px;
      border-radius: 7px;
    }


    .table-building img {
      object-fit: cover;
    }


    .table-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eff6ff;
      color: #1570ef;
    }


    .table-placeholder mat-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
      line-height: 20px;
    }


    .table-building strong,
    .table-building small {
      display: block;
    }


    .table-building small {
      margin-top: 4px;
      color: #98a2b3;
      font-size: 10px;
    }


    td > a {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: #1570ef;
      text-decoration: none;
      font-weight: 700;
    }


    td > a mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      line-height: 16px;
    }


    /* ==========================================================
       BOTTOM
    ========================================================== */

    .bottom-grid {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 16px;
    }


    .bottom-card {
      min-height: 215px;
      padding: 18px;
      background: #fff;
      border: 1px solid var(--resq-border);
      border-radius: 11px;
    }


    .bottom-header {
      display: flex;
      align-items: center;
      gap: 11px;
      margin-bottom: 20px;
    }


    .bottom-icon {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      background: #eff6ff;
      color: #1570ef;
    }


    .bottom-icon mat-icon {
      width: 21px;
      height: 21px;
      font-size: 21px;
      line-height: 21px;
    }


    .bottom-header h2 {
      margin: 0;
      color: #101828;
      font-size: 15px;
    }


    .bottom-header p {
      margin: 4px 0 0;
      color: #98a2b3;
      font-size: 11px;
    }


    /* ==========================================================
       SUMMARY
    ========================================================== */

    .summary-list {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }


    .summary-row {
      display: grid;
      grid-template-columns:
        95px
        minmax(100px, 1fr)
        25px
        45px;
      gap: 11px;
      align-items: center;
    }


    .summary-name {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #475467;
      font-size: 12px;
    }


    .summary-dot {
      width: 10px;
      height: 10px;
      flex: 0 0 auto;
      border-radius: 50%;
    }


    .summary-critical {
      background: #f04438;
    }


    .summary-warning {
      background: #fdb022;
    }


    .summary-normal {
      background: #12b76a;
    }


    .summary-track {
      height: 11px;
      overflow: hidden;
      background: #f2f4f7;
      border-radius: 999px;
    }


    .summary-progress {
      height: 100%;
      border-radius: 999px;
    }


    .progress-critical {
      background: #f04438;
    }


    .progress-warning {
      background: #fdb022;
    }


    .progress-normal {
      background: #12b76a;
    }


    .summary-row strong {
      color: #344054;
      font-size: 12px;
    }


    .summary-percent {
      color: #98a2b3;
      font-size: 11px;
    }


    /* ==========================================================
       ACTIVITY
    ========================================================== */

    .activity-header {
      justify-content: space-between;
    }


    .activity-heading {
      display: flex;
      align-items: center;
      gap: 11px;
    }


    .activity-header > a {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: #1570ef;
      text-decoration: none;
      font-size: 11px;
    }


    .activity-header > a mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      line-height: 16px;
    }


    .activity-list {
      display: flex;
      flex-direction: column;
    }


    .activity-item {
      min-height: 52px;
      display: grid;
      grid-template-columns:
        36px
        minmax(0, 1fr)
        auto;
      gap: 11px;
      align-items: center;
      border-bottom: 1px solid #f2f4f7;
    }


    .activity-item:last-child {
      border-bottom: 0;
    }


    .activity-icon {
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }


    .activity-icon mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      line-height: 18px;
    }


    .activity-critical {
      background: #fff1f3;
      color: #f04438;
    }


    .activity-warning {
      background: #fffaeb;
      color: #f79009;
    }


    .activity-info {
      background: #ecfdf3;
      color: #12b76a;
    }


    .activity-content {
      min-width: 0;
    }


    .activity-content strong,
    .activity-content small {
      display: block;
    }


    .activity-content strong {
      color: #344054;
      font-size: 12px;
    }


    .activity-content small {
      margin-top: 4px;
      overflow: hidden;
      color: #98a2b3;
      font-size: 10px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }


    .activity-item time {
      color: #98a2b3;
      font-size: 10px;
      white-space: nowrap;
    }


    /* ==========================================================
       MODAL
    ========================================================== */

    .dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgb(16 24 40 / 48%);
    }


    .floor-dialog {
      width: min(460px, 100%);
      overflow: hidden;
      border-radius: 13px;
      background: #fff;
      box-shadow:
        0 24px 48px rgb(16 24 40 / 20%);
    }


    .floor-dialog > header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 19px;
      border-bottom: 1px solid #eaecf0;
    }


    .dialog-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }


    .dialog-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      background: #eff6ff;
      color: #1570ef;
    }


    .dialog-icon mat-icon {
      width: 21px;
      height: 21px;
      font-size: 21px;
      line-height: 21px;
    }


    .floor-dialog h2 {
      margin: 0;
      color: #101828;
      font-size: 18px;
    }


    .floor-dialog p {
      margin: 5px 0 0;
      color: #98a2b3;
      font-size: 12px;
    }


    .close-dialog {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #667085;
      cursor: pointer;
    }


    .close-dialog:hover {
      background: #f2f4f7;
    }


    .close-dialog mat-icon {
      width: 21px;
      height: 21px;
      font-size: 21px;
      line-height: 21px;
    }


    .dialog-floors {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
    }


    .dialog-floors > button {
      min-height: 65px;
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        auto
        22px;
      gap: 13px;
      align-items: center;
      padding: 11px 13px;
      border: 1px solid #eaecf0;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      text-align: left;
    }


    .dialog-floors > button:hover {
      border-color: #b2ccff;
      background: #f9fbff;
    }


    .dialog-floor-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }


    .dialog-floor-icon {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: #eff6ff;
      color: #1570ef;
    }


    .dialog-floor-icon mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      line-height: 18px;
    }


    .dialog-floors strong,
    .dialog-floors small {
      display: block;
    }


    .dialog-floors strong {
      color: #344054;
      font-size: 13px;
    }


    .dialog-floors small {
      margin-top: 4px;
      color: #98a2b3;
      font-size: 11px;
    }


    .dialog-arrow {
      width: 20px;
      height: 20px;
      color: #98a2b3;
      font-size: 20px;
      line-height: 20px;
    }


    /* ==========================================================
       RESPONSIVE
    ========================================================== */

    @media (max-width: 1300px) {

      .building-grid {
        grid-template-columns:
          repeat(
            2,
            minmax(360px, 1fr)
          );
      }

    }


    @media (max-width: 1050px) {

      .kpi-grid {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }


      .bottom-grid {
        grid-template-columns: 1fr;
      }

    }


    @media (max-width: 850px) {

      .page-header {
        align-items: stretch;
        flex-direction: column;
      }


      .search-box {
        width: auto;
      }


      .controls-bar {
        align-items: stretch;
        flex-direction: column;
      }


      .filters {
        flex-wrap: wrap;
      }


      .filters select {
        flex: 1 1 150px;
      }


      .add-building {
        flex: 1 1 100%;
      }


      .building-grid {
        grid-template-columns: 1fr;
      }

    }


    @media (max-width: 600px) {

      .kpi-grid {
        grid-template-columns: 1fr;
      }


      .building-header {
        grid-template-columns: 1fr;
      }


      .building-photo {
        width: 100%;
        height: 170px;
      }


      .address {
        margin-left: 0;
      }


      .building-metrics {
        grid-template-columns: 1fr;
      }


      .building-actions {
        grid-template-columns: 1fr;
      }


      .summary-row {
        grid-template-columns:
          90px
          minmax(60px, 1fr)
          25px;
      }


      .summary-percent {
        display: none;
      }


      .activity-item {
        grid-template-columns:
          36px
          minmax(0, 1fr);
      }


      .activity-item time {
        grid-column: 2;
      }

    }

  `],
})
export class BuildingsPage {

  private readonly buildingStore =
    inject(BuildingStoreService);

  private readonly router =
    inject(Router);

  private readonly alertService =
    inject(AlertService);


  readonly buildings =
    this.buildingStore.buildings;


  readonly recentAlertItems =
    signal<AlertListItem[]>([]);


  readonly query =
    signal('');


  readonly viewMode =
    signal<'grid' | 'table'>('grid');


  readonly statusFilter =
    signal<'All' | RiskStatus>('All');


  readonly sortMode =
    signal<
      'critical' |
      'name' |
      'devices' |
      'alerts'
    >('critical');


  readonly floorSelectorBuilding =
    signal<Building | undefined>(
      undefined
    );


  readonly summaryStatuses:
    RiskStatus[] = [
      'Critical',
      'Warning',
      'Normal',
    ];


  constructor() {
    this.alertService
      .getRecentAlerts('24h')
      .subscribe(items =>
        this.recentAlertItems.set(items)
      );
  }

  readonly displayedBuildings =
    computed(() => {

      const query =
        this.query()
          .trim()
          .toLowerCase();


      const status =
        this.statusFilter();


      const sort =
        this.sortMode();


      let result =
        this.buildings().filter(
          building => {

            const searchable =
              (
                building.name +
                ' ' +
                building.address
              ).toLowerCase();


            const matchesQuery =
              !query ||
              searchable.includes(query);


            const matchesStatus =
              status === 'All' ||
              building.status === status;


            return (
              matchesQuery &&
              matchesStatus
            );
          }
        );


      result =
        [...result].sort(
          (a, b) => {

            if (sort === 'name') {

              return a.name.localeCompare(
                b.name
              );

            }


            if (sort === 'devices') {

              return (
                this.deviceCount(b) -
                this.deviceCount(a)
              );

            }


            if (sort === 'alerts') {

              return (
                this.recentAlertsFor(b) -
                this.recentAlertsFor(a)
              );

            }


            return (
              riskRank[b.status] -
              riskRank[a.status]
            );

          }
        );


      return result;

    });


  totalFloors(): number {

    return this.buildings().reduce(
      (total, building) =>
        total +
        building.floors.length,
      0
    );

  }


  activeDevices(): number {

    return this.buildingStore.devices().filter(
      device =>
        device.status !== 'Offline'
    ).length;

  }


  buildingsWithRecentAlerts(): number {

    return this.buildings().filter(
      building =>
        this.recentAlertsFor(building) > 0
    ).length;

  }


  spaceCount(
    building: Building
  ): number {

    return building.floors.reduce(
      (total, floor) =>
        total +
        floor.spaces.length,
      0
    );

  }


  deviceCount(
    building: Building
  ): number {

    const spaceIds =
      new Set(
        building.floors.flatMap(
          floor =>
            floor.spaces.map(
              space => space.id
            )
        )
      );


    return this.buildingStore.devices().filter(
      device =>
        spaceIds.has(
          device.spaceId
        )
    ).length;

  }


  offlineDeviceCount(
    building: Building
  ): number {

    const spaceIds =
      new Set(
        building.floors.flatMap(
          floor =>
            floor.spaces.map(
              space => space.id
            )
        )
      );


    return this.buildingStore.devices().filter(
      device =>
        spaceIds.has(device.spaceId) &&
        device.status === 'Offline'
    ).length;

  }


  criticalSpaces(
    building: Building
  ): number {

    return building.floors
      .flatMap(
        floor =>
          floor.spaces
      )
      .filter(
        space =>
          space.status === 'Critical'
      )
      .length;

  }


  recentAlertsFor(
    building: Building
  ): number {

    return this.recentAlertItems().filter(
      alert => alert.location.buildingId === building.id
    ).length;

  }


  reversedFloors(
    building: Building
  ) {

    return [
      ...building.floors
    ].sort(
      (a, b) =>
        b.level - a.level
    );

  }


  summaryCount(
    status: RiskStatus
  ): number {

    return this.buildings().filter(
      building =>
        building.status === status
    ).length;

  }


  summaryPercentage(
    status: RiskStatus
  ): number {

    if (!this.buildings().length) {
      return 0;
    }


    return Math.round(
      (
        this.summaryCount(status) /
        this.buildings().length
      ) * 100
    );

  }


  recentBuildingActivity() {

    return this.buildings()
      .map(
        building => {

          const latestAlert =
            this.recentAlertItems()
              .filter(
                alert =>
                  alert.location.buildingId ===
                  building.id
              )
              .sort(
                (a, b) =>
                  b.generatedAt.getTime() -
                  a.generatedAt.getTime()
              )[0];


          if (!latestAlert) {

            return {

              id:
                building.id +
                '-stable',

              title:
                'All systems stable',

              severity:
                'Info' as const,

              buildingName:
                building.name,

              address:
                building.address,

              timestamp:
                new Date(),

            };

          }


          return {

            id:
              latestAlert.id,

            title:
              latestAlert.title,

            severity:
              latestAlert.severity,

            buildingName:
              building.name,

            address:
              building.address,

            timestamp:
              latestAlert.generatedAt,

          };

        }
      )
      .sort(
        (a, b) =>
          b.timestamp.getTime() -
          a.timestamp.getTime()
      )
      .slice(0, 3);

  }


  timeAgo(
    date: Date
  ): string {

    const difference =
      Date.now() -
      date.getTime();


    const minutes =
      Math.max(
        0,
        Math.floor(
          difference / 60_000
        )
      );


    if (minutes < 1) {
      return 'now';
    }


    if (minutes < 60) {
      return `${minutes} min ago`;
    }


    const hours =
      Math.floor(
        minutes / 60
      );


    if (hours < 24) {
      return `${hours} h ago`;
    }


    return `${
      Math.floor(hours / 24)
    } d ago`;

  }


  openFloorSelector(
    building: Building
  ): void {

    this.floorSelectorBuilding
      .set(building);

  }


  closeFloorSelector(): void {

    this.floorSelectorBuilding
      .set(undefined);

  }


  openFloor(
    building: Building,
    floorId: string
  ): void {

    this.closeFloorSelector();


    this.router.navigate([
      '/monitoring',
      building.id,
      'floors',
      floorId,
    ]);

  }

}

/* ============================================================
   BUILDING DETAIL
============================================================ */

@Component({
  selector: 'resq-building-detail',

  standalone: true,

  imports: [
    RouterLink,
    MatIconModule,
    StatusBadgeComponent,
    ThreeBuildingViewerComponent,
    MatSnackBarModule,
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `

    @if (building()) {

      <div class="detail-head">

        <div>

          <a routerLink="/buildings">

            <mat-icon>
              arrow_back
            </mat-icon>

            Buildings

          </a>


          <div class="detail-title">

            <span class="detail-building-icon">

              <mat-icon>
                apartment
              </mat-icon>

            </span>

            <div>

              <h1>
                {{ building()!.name }}
              </h1>

              <p>

                <mat-icon>
                  location_on
                </mat-icon>

                {{ building()!.address }}

                <span>·</span>

                {{ building()!.description }}

              </p>

            </div>

          </div>

        </div>


        <div class="detail-actions">

          <resq-status-badge
            [status]="building()!.status"
          />

          <a [routerLink]="['/buildings', building()!.id, 'edit']">
            <mat-icon>edit</mat-icon>
            Edit Building
          </a>

          <button type="button" class="delete-building" (click)="deleteConfirmationOpen.set(true)">
            <mat-icon>delete_outline</mat-icon>
            Delete Building
          </button>

          <button type="button" (click)="openDetailFloor(reversedDetailFloors()[0].id)">
            <mat-icon>map</mat-icon>
            Floor Monitoring
          </button>

        </div>

      </div>


      <!-- KPIS -->

      <section class="detail-kpis">

        <article>

          <span class="detail-kpi-icon blue">

            <mat-icon>
              layers
            </mat-icon>

          </span>

          <div>

            <strong>
              {{ building()!.floors.length }}
            </strong>

            <span>
              Floors
            </span>

          </div>

        </article>


        <article>

          <span class="detail-kpi-icon green">

            <mat-icon>
              grid_view
            </mat-icon>

          </span>

          <div>

            <strong>
              {{ spaces() }}
            </strong>

            <span>
              Monitored Spaces
            </span>

          </div>

        </article>


        <article>

          <span class="detail-kpi-icon blue">

            <mat-icon>
              sensors
            </mat-icon>

          </span>

          <div>

            <strong>
              {{ devices() }}
            </strong>

            <span>
              Connected Devices
            </span>

          </div>

        </article>


        <article>

          <span class="detail-kpi-icon red">

            <mat-icon>
              warning_amber
            </mat-icon>

          </span>

          <div>

            <strong>
              {{ activeAlerts() }}
            </strong>

            <span>
              Active Alerts
            </span>

          </div>

        </article>

      </section>


      <!-- BUILDING OVERVIEW -->

      <article class="overview">

        <div class="overview-info">

          <span class="overview-icon">

            <mat-icon>
              apartment
            </mat-icon>

          </span>

          <h2>
            Building Overview
          </h2>

          <p>
            Select a floor to open live monitoring
          </p>

        </div>


        <div class="building-model">
          @defer (on viewport) {
            <resq-three-building-viewer
              [building]="building()!"
              [hoveredFloorId]="hoveredFloorId()"
            />
          } @placeholder {
            <div class="building-model-placeholder">
              <mat-icon>view_in_ar</mat-icon>
              <span>Loading 3D building overview…</span>
            </div>
          }
        </div>


        <div class="floor-summary">

          @for (
            floor of building()!.floors;
            track floor.id
          ) {

            <article
              [class.hovered]="hoveredFloorId() === floor.id"
              (mouseenter)="hoveredFloorId.set(floor.id)"
              (mouseleave)="hoveredFloorId.set(undefined)"
            >

              <div class="floor-summary-info">

                <span class="floor-summary-icon">

                  <mat-icon>
                    layers
                  </mat-icon>

                </span>

                <div>

                  <strong>
                    Floor {{ floor.level }}
                  </strong>

                  <small>
                    {{ floor.spaces.length }}
                    spaces · {{ floorDevices(floor.id) }} devices
                  </small>

                  <small [class.configured]="floor.planConfigured">
                    Floor Plan: {{ floor.planConfigured ? 'Configured' : 'Not Configured' }}
                  </small>

                </div>

              </div>


              <resq-status-badge
                [status]="floor.status"
              />

              <div class="floor-actions">
                <button type="button" (click)="openDetailFloor(floor.id)"><mat-icon>monitoring</mat-icon>Monitor</button>
                <a [routerLink]="['/buildings', building()!.id, 'floors', floor.id, 'editor']">
                  <mat-icon>edit</mat-icon>
                  {{ floor.planConfigured ? 'Edit Plan' : 'Configure Plan' }}
                </a>
              </div>

            </article>

          }

        </div>

      </article>

      @if (deleteConfirmationOpen()) {
        <div class="delete-dialog-backdrop" role="presentation">
          <section class="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-building-title">
            <mat-icon>warning_amber</mat-icon>
            <h2 id="delete-building-title">Delete {{ building()!.name }}?</h2>
            <p>This building contains:</p>
            <ul><li>{{building()!.floors.length}} floors</li><li>{{spaces()}} spaces</li><li>{{devices()}} devices</li><li>{{activeAlerts()}} active alerts</li></ul>
            <div>
              <button type="button" (click)="deleteConfirmationOpen.set(false)">Cancel</button>
              <button type="button" class="confirm-delete" (click)="confirmDeleteBuilding()">Delete Building</button>
            </div>
          </section>
        </div>
      }

    } @else {

      <div class="not-found">

        <mat-icon>
          domain_disabled
        </mat-icon>

        <h2>
          Building not found
        </h2>

        <a routerLink="/buildings">
          Back to Buildings
        </a>

      </div>

    }

  `,

  styles: [`

    :host {
      display: block;
    }


    mat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }


    .detail-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 18px;
    }


    .detail-head > div > a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #1570ef;
      text-decoration: none;
      font-size: 12px;
    }


    .detail-head > div > a mat-icon {
      width: 17px;
      height: 17px;
      font-size: 17px;
      line-height: 17px;
    }


    .detail-actions {
      display: flex;
      align-items: center;
      gap: 9px;
    }


    .detail-actions a,
    .detail-actions button {
      min-height: 40px;
      padding: 0 13px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: 1px solid var(--resq-border);
      border-radius: 7px;
      background: #fff;
      color: #344054;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
    }

    .detail-actions .delete-building {
      border-color: #fda29b;
      background: #fff;
      color: #d92d20;
    }


    .detail-actions button {
      border-color: #1570ef;
      background: #1570ef;
      color: #fff;
      cursor: pointer;
    }


    .detail-actions mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      line-height: 18px;
    }


    .detail-title {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
    }


    .detail-building-icon {
      width: 48px;
      height: 48px;
      flex: 0 0 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background: #eff6ff;
      color: #1570ef;
    }


    .detail-building-icon mat-icon {
      width: 25px;
      height: 25px;
      font-size: 25px;
      line-height: 25px;
    }


    .detail-title h1 {
      margin: 0;
      color: #101828;
      font-size: 24px;
    }


    .detail-title p {
      margin: 5px 0 0;
      display: flex;
      align-items: center;
      gap: 5px;
      color: #667085;
      font-size: 12px;
    }


    .detail-title p mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      line-height: 16px;
    }


    /* KPIS */

    .detail-kpis {
      display: grid;
      grid-template-columns:
        repeat(4, minmax(0, 1fr));
      gap: 12px;
    }


    .detail-kpis article {
      min-height: 90px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 13px;
      background: #fff;
      border: 1px solid var(--resq-border);
      border-radius: 11px;
    }


    .detail-kpi-icon {
      width: 46px;
      height: 46px;
      flex: 0 0 46px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
    }


    .detail-kpi-icon mat-icon {
      width: 23px;
      height: 23px;
      font-size: 23px;
      line-height: 23px;
    }


    .detail-kpi-icon.blue {
      background: #eff6ff;
      color: #1570ef;
    }


    .detail-kpi-icon.green {
      background: #ecfdf3;
      color: #039855;
    }


    .detail-kpi-icon.red {
      background: #fff1f3;
      color: #f04438;
    }


    .detail-kpis strong {
      display: block;
      color: #101828;
      font-size: 23px;
    }


    .detail-kpis span {
      display: block;
      margin-top: 3px;
      color: #667085;
      font-size: 12px;
    }


    /* OVERVIEW */

    .overview {
      min-height: 520px;
      margin-top: 16px;
      padding: 22px;
      display: grid;
      grid-template-columns:
        minmax(180px, .8fr)
        minmax(400px, 2fr)
        minmax(250px, 1fr);
      gap: 20px;
      background: #fff;
      border: 1px solid var(--resq-border);
      border-radius: 12px;
    }

    .building-model {
      min-width: 0;
      align-self: stretch;
    }

    .building-model-placeholder {
      min-height: 500px;
      display: grid;
      place-content: center;
      gap: 8px;
      border-radius: 10px;
      background: linear-gradient(180deg, #f7f9fc, #eaf0f6);
      color: #667085;
      text-align: center;
      font-size: 12px;
    }

    .building-model-placeholder mat-icon { margin: auto; color: #1570ef; }


    .overview-icon {
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      border-radius: 9px;
      background: #eff6ff;
      color: #1570ef;
    }


    .overview-icon mat-icon {
      width: 22px;
      height: 22px;
      font-size: 22px;
      line-height: 22px;
    }


    .overview h2 {
      margin: 0;
      color: #101828;
      font-size: 17px;
    }


    .overview p {
      margin: 5px 0 0;
      color: #98a2b3;
      font-size: 12px;
    }


    /* BUILDING STACK */

    .stack {
      position: relative;
      min-height: 450px;
      perspective: 1000px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }


    .floor {
      width: 370px;
      height: 85px;
      position: relative;
      z-index: calc(10 - var(--i));
      margin: -9px 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      transform:
        rotateX(58deg)
        rotateZ(-25deg);
      transition:
        transform .2s ease;
    }


    .floor:hover {
      transform:
        rotateX(58deg)
        rotateZ(-25deg)
        translateZ(25px)
        translateY(-10px);
    }


    .slab {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      border: 1px solid #91a4b8;
      background:
        linear-gradient(
          135deg,
          #edf2f7,
          #cfd9e4
        );
      box-shadow:
        -8px 12px 15px
        rgb(29 53 87 / 15%);
      text-align: center;
    }


    .floor.warning .slab {
      border: 2px solid #fdb022;
    }


    .floor.critical .slab {
      border: 2px solid #f04438;
    }


    .slab b {
      color: #344054;
      font-size: 13px;
    }


    .slab small {
      margin-top: 4px;
      color: #667085;
      font-size: 10px;
    }


    .floor > em {
      width: 28px;
      height: 28px;
      position: absolute;
      top: 28px;
      right: -42px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: #1570ef;
      color: #fff;
      font-style: normal;
      transform:
        rotateZ(25deg)
        rotateX(-58deg);
    }


    /* FLOOR SUMMARY */

    .floor-summary {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 9px;
    }


    .floor-summary > article {
      min-height: 65px;
      padding: 10px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      border: 1px solid var(--resq-border);
      border-radius: 8px;
      background: #fff;
      text-align: left;
    }


    .floor-summary > article:hover {
      border-color: #b2ccff;
      background: #f9fbff;
    }

    .floor-summary > article.hovered {
      border-color: #84adff;
      background: #f5f8ff;
      box-shadow: 0 8px 20px rgb(21 112 239 / 10%);
    }

    .delete-dialog-backdrop {
      position: fixed;
      z-index: 1200;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgb(15 23 42 / 52%);
    }

    .delete-dialog {
      width: min(450px, 100%);
      padding: 25px;
      border-radius: 14px;
      background: #fff;
      box-shadow: 0 24px 60px rgb(15 23 42 / 28%);
    }

    .delete-dialog > mat-icon { color: #d92d20; }
    .delete-dialog h2 { margin: 12px 0 8px; font-size: 20px; }
    .delete-dialog p { margin: 0; color: #667085; font-size: 13px; line-height: 1.55; }
    .delete-dialog ul { margin: 10px 0 0; padding-left: 20px; color: #475467; font-size: 13px; line-height: 1.7; }
    .delete-dialog > div { display: flex; justify-content: flex-end; gap: 9px; margin-top: 22px; }
    .delete-dialog button { min-height: 38px; padding: 0 14px; border: 1px solid #d0d5dd; border-radius: 7px; background: #fff; color: #344054; font-weight: 700; cursor: pointer; }
    .delete-dialog .confirm-delete { border-color: #d92d20; background: #d92d20; color: #fff; }


    .floor-summary-info {
      display: flex;
      align-items: center;
      gap: 9px;
    }


    .floor-summary-icon {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: #eff6ff;
      color: #1570ef;
    }


    .floor-summary-icon mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      line-height: 18px;
    }


    .floor-summary strong {
      display: block;
      color: #344054;
      font-size: 12px;
    }


    .floor-summary small {
      display: block;
      margin-top: 3px;
      color: #98a2b3;
      font-size: 10px;
    }


    .floor-summary small.configured {
      color: #079455;
    }


    .floor-actions {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }


    .floor-actions a,
    .floor-actions button {
      min-height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--resq-border);
      border-radius: 6px;
      background: #fff;
      color: #1570ef;
      text-decoration: none;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      gap: 6px;
    }

    .floor-actions mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      line-height: 18px;
    }


    .floor-actions button {
      border-color: #1570ef;
      background: #1570ef;
      color: #fff;
      cursor: pointer;
    }


    .floor-summary > button > mat-icon {
      width: 19px;
      height: 19px;
      color: #98a2b3;
      font-size: 19px;
      line-height: 19px;
    }


    /* NOT FOUND */

    .not-found {
      min-height: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }


    .not-found > mat-icon {
      width: 55px;
      height: 55px;
      color: #98a2b3;
      font-size: 55px;
      line-height: 55px;
    }


    .not-found h2 {
      margin: 15px 0 8px;
    }


    .not-found a {
      color: #1570ef;
      text-decoration: none;
    }


    @media (max-width: 1050px) {

      .detail-kpis {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }


      .overview {
        grid-template-columns:
          1fr 1.5fr;
      }


      .floor-summary {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }

    }


    @media (max-width: 650px) {

      .detail-kpis {
        grid-template-columns: 1fr;
      }


      .overview {
        grid-template-columns: 1fr;
      }


      .stack {
        margin: -40px;
        transform: scale(.75);
      }


      .floor-summary {
        grid-template-columns: 1fr;
      }


      .detail-title p {
        align-items: flex-start;
        flex-wrap: wrap;
      }

    }

  `],
})
export class BuildingDetailPage
  implements OnInit {

  readonly recentAlertItems = signal<AlertListItem[]>([]);

  readonly building =
    signal<Building | undefined>(
      undefined
    );

  readonly hoveredFloorId = signal<string | undefined>(undefined);
  readonly deleteConfirmationOpen = signal(false);


  constructor(
    private readonly route:
      ActivatedRoute,

    private readonly router:
      Router,

    private readonly buildingStore:
      BuildingStoreService,

    private readonly snackBar:
      MatSnackBar,
    private readonly alertService:
      AlertService,
  ) {}


  ngOnInit(): void {

    const buildingId =
      this.route.snapshot
        .paramMap
        .get('buildingId');


    this.building.set(
      buildingId
        ? this.buildingStore.getBuilding(buildingId)
        : undefined
    );

    this.alertService
      .getRecentAlerts('24h')
      .subscribe(items => this.recentAlertItems.set(items));

  }


  spaces(): number {

    return (
      this.building()
        ?.floors
        .flatMap(
          floor =>
            floor.spaces
        )
        .length ??
      0
    );

  }


  devices(): number {

    const ids =
      new Set(
        this.building()
          ?.floors
          .flatMap(
            floor =>
              floor.spaces.map(
                space =>
                  space.id
              )
          ) ??
        []
      );


    return this.buildingStore.devices().filter(
      device =>
        ids.has(device.spaceId)
    ).length;

  }


  floorDevices(floorId: string): number {
    const floor = this.building()?.floors.find(item => item.id === floorId);
    const spaceIds = new Set(floor?.spaces.map(space => space.id) ?? []);
    return this.buildingStore.devices().filter(device => spaceIds.has(device.spaceId)).length;
  }


  activeAlerts(): number {

    const buildingId =
      this.building()?.id;


    if (!buildingId) {
      return 0;
    }


    return this.recentAlertItems().filter(
      alert => alert.location.buildingId === buildingId
    ).length;

  }


  reversedDetailFloors() {

    return [
      ...(
        this.building()
          ?.floors ??
        []
      )
    ].sort(
      (a, b) =>
        b.level - a.level
    );

  }


  openDetailFloor(
    floorId: string
  ): void {

    const buildingId =
      this.building()?.id;


    if (!buildingId) {
      return;
    }


    this.router.navigate([
      '/monitoring',
      buildingId,
      'floors',
      floorId,
    ]);

  }

  confirmDeleteBuilding(): void {
    const buildingId = this.building()?.id;
    if (!buildingId) return;
    this.buildingStore.deleteBuilding(buildingId);
    this.deleteConfirmationOpen.set(false);
    this.snackBar.open('Building deleted successfully', 'Close', { duration: 3000, horizontalPosition: 'right', verticalPosition: 'top' });
    this.router.navigate(['/buildings']);
  }

}
