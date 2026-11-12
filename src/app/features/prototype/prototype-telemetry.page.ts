import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, interval, of, startWith, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface PrototypeReading {
  channelId: number;
  entryId: number;
  measuredAt: string;
  gasAdc: number | null;
  temperatureC: number | null;
  wifiRssiDbm: number | null;
  alertFlag: number | null;
  motion: number | null;
  humidityPercent: number | null;
}

@Component({
  selector: 'resq-prototype-telemetry',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="prototype">
      <header class="top">
        <div class="brand"><span class="brand-icon">R</span><span>ResQ <small>IoT monitoring</small></span></div>
        <a href="/login">Volver a ResQ</a>
      </header>
      <section class="intro">
        <div class="eyebrow">PROTOTIPO FÍSICO · ESP32</div>
        <h1>Monitoreo en tiempo real</h1>
        <p>Lecturas de ThingSpeak a través de la API ResQ. Actualización automática cada 25 segundos.</p>
        @if (error()) {
          <div class="notice failure" role="alert">{{ error() }} <button type="button" (click)="refresh()">Reintentar</button></div>
        } @else if (!reading()) {
          <div class="notice">Esperando las primeras lecturas del prototipo…</div>
        }
        <div class="status">
          <span class="dot" [class.live]="fresh()" [class.offline]="!fresh()"></span>
          <b>{{ fresh() ? 'Datos recientes' : 'Sin datos recientes' }}</b>
          @if (reading(); as item) {
            <span>Última lectura: {{ item.measuredAt | date:'dd/MM/yyyy HH:mm:ss' }}</span>
            <span>Registro #{{item.entryId}}</span>
          }
          <button type="button" (click)="refresh()" [disabled]="loading()">{{ loading() ? 'Actualizando…' : 'Actualizar' }}</button>
        </div>
      </section>

      @if (reading(); as item) {
        <section class="grid" aria-label="Sensores del prototipo">
          <article class="sensor"><span class="label">🌡️ Temperatura</span><strong>{{item.temperatureC === null ? '—' : (item.temperatureC | number:'1.1-1')}}</strong><span class="unit">°C · DHT22</span></article>
          <article class="sensor"><span class="label">💧 Humedad</span><strong>{{item.humidityPercent === null ? '—' : (item.humidityPercent | number:'1.1-1')}}</strong><span class="unit">% · DHT22</span></article>
          <article class="sensor"><span class="label">🌫️ Gas MQ-2</span><strong>{{item.gasAdc === null ? '—' : item.gasAdc}}</strong><span class="unit">ADC sin calibrar · No representa PPM</span></article>
          <article class="sensor"><span class="label">🚶 Movimiento PIR</span><strong class="state" [class.alert]="item.motion === 1">{{item.motion === null ? '—' : item.motion === 1 ? 'Detectado' : 'Sin movimiento'}}</strong><span class="unit">Campo 5 · Sensor PIR</span></article>
          <article class="sensor"><span class="label">📶 Señal Wi-Fi</span><strong>{{item.wifiRssiDbm === null ? '—' : item.wifiRssiDbm}}</strong><span class="unit">dBm · RSSI</span></article>
          <article class="sensor" [class.warning]="item.alertFlag === 1"><span class="label">🚨 Alerta del firmware</span><strong class="state">{{item.alertFlag === null ? '—' : item.alertFlag === 1 ? 'ACTIVA' : 'NORMAL'}}</strong><span class="unit">Campo 4 · Bandera reportada por ESP32</span></article>
        </section>
        <p class="footnote">Los datos pueden ser reales o del modo DEMO del ESP32. Esta vista muestra la bandera del firmware; no equivale a una alerta/incident persistido del backend. Si el dispositivo deja de transmitir, se conserva la última lectura y se marca como antigua.</p>
      }
    </main>
  `,
  styles: [`
    :host{display:block;min-height:100vh;background:#f3f6fa;color:#172a3a;font-family:Inter,Arial,sans-serif}
    .prototype{max-width:1100px;margin:auto;padding:0 24px 60px}
    .top{display:flex;justify-content:space-between;align-items:center;padding:24px 0;border-bottom:1px solid #dce3eb}
    .top a{color:#145c92;text-decoration:none;font-weight:600}
    .brand{display:flex;align-items:center;gap:12px;font-size:23px;font-weight:800}
    .brand small{display:block;font-size:12px;letter-spacing:1px;font-weight:500;color:#627386}
    .brand-icon{width:44px;height:44px;display:grid;place-items:center;background:#124f77;color:white;border-radius:13px}
    .intro{padding:36px 0 24px}.eyebrow{font-size:12px;letter-spacing:2px;font-weight:800;color:#2077a5}
    h1{font-size:clamp(30px,4vw,46px);margin:10px 0 8px}p{color:#57677a;line-height:1.6}
    .status{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:24px;padding:16px;border:1px solid #dee6ee;border-radius:13px;background:white}
    .status span{font-size:13px;color:#657589}.status b{font-size:14px}.dot{width:10px;height:10px;background:#c7a142;border-radius:50%}.dot.live{background:#27a16c}.dot.offline{background:#b15a4b}
    button{cursor:pointer;padding:9px 14px;border:1px solid #c3d0dd;border-radius:9px;background:#fff;color:#164e75;font-weight:700}
    button:disabled{opacity:.5;cursor:default}.status button{margin-left:auto}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
    .sensor{background:white;border:1px solid #dce5ef;box-shadow:0 3px 10px rgba(21,52,77,.04);border-radius:16px;min-height:176px;padding:24px;display:flex;flex-direction:column;gap:15px}
    .sensor.warning{border-color:#f0b1a9;background:#fff6f5}.label{font-weight:700;font-size:15px}.sensor strong{font-size:38px;letter-spacing:-1.5px}.sensor strong.state{font-size:27px}.sensor strong.alert{color:#bc473b}.unit{font-size:12px;color:#748294;margin-top:auto}
    .notice{background:#fff;padding:16px;border:1px solid #dce5ef;border-radius:12px;margin:20px 0}.failure{border-color:#e2a39b;color:#9c332c;display:flex;justify-content:space-between;align-items:center}
    .footnote{font-size:13px;margin:20px 0}
    @media(max-width:820px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:540px){.grid{grid-template-columns:1fr}.prototype{padding:0 15px 40px}.top{gap:15px}.sensor{min-height:140px}}
  `],
})
export class PrototypeTelemetryPage {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly reading = signal<PrototypeReading | null>(null);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly now = signal(Date.now());
  readonly fresh = () => {
    const data = this.reading();
    return !!data && this.now() - new Date(data.measuredAt).getTime() <= 120_000;
  };

  constructor() {
    interval(25_000).pipe(
      startWith(0),
      switchMap(() => {
        this.loading.set(true);
        return this.http.get<PrototypeReading | { message: string }>(
          `${environment.apiBaseUrl}/api/v1/prototype/telemetry/latest`,
        ).pipe(catchError(() => {
          this.error.set('No se pudo consultar la telemetría. Revisa la configuración del backend en Render.');
          this.loading.set(false);
          return of(null);
        }));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((result) => {
      this.now.set(Date.now());
      this.loading.set(false);
      if (!result) return;
      if ('measuredAt' in result) {
        this.reading.set(result);
        this.error.set('');
      } else {
        this.error.set(result.message || 'No hay lecturas disponibles.');
      }
    });
  }

  refresh(): void {
    this.loading.set(true);
    this.http.get<PrototypeReading>(`${environment.apiBaseUrl}/api/v1/prototype/telemetry/latest`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.now.set(Date.now());
          if (data.measuredAt) { this.reading.set(data); this.error.set(''); }
          else this.error.set('Aún no hay lecturas disponibles.');
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo actualizar la telemetría.');
          this.loading.set(false);
        },
      });
  }
}
