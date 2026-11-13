import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AnalyticsWorkspaceFacade } from '../analytics/analytics-workspace.facade';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage monitoring refresh', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('polls Monitoring every 30 seconds and stops after destruction', () => {
    vi.useFakeTimers();
    const analytics = analyticsStub();
    const injector = createEnvironmentInjector(
      [{ provide: AnalyticsWorkspaceFacade, useValue: analytics }],
      TestBed.inject(EnvironmentInjector),
    );
    const dashboard = runInInjectionContext(injector, () => new DashboardPage());

    dashboard.ngOnInit();
    vi.advanceTimersByTime(0);
    expect(analytics.load).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    expect(analytics.load).toHaveBeenCalledTimes(2);

    injector.destroy();
    vi.advanceTimersByTime(60_000);
    expect(analytics.load).toHaveBeenCalledTimes(2);
  });
});

function analyticsStub() {
  return {
    alerts: signal([]).asReadonly(),
    incidents: signal([]).asReadonly(),
    devices: signal([]).asReadonly(),
    measurements: signal([]).asReadonly(),
    buildings: signal([]).asReadonly(),
    loading: signal(false).asReadonly(),
    error: signal(undefined).asReadonly(),
    partialErrors: signal([]).asReadonly(),
    load: vi.fn(() => of(undefined)),
  };
}
