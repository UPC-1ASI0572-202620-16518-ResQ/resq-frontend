import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'resq-sidebar', standalone: true, imports: [RouterLink, RouterLinkActive], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="brand"><div class="logo">◇</div><div><b>ResQ</b><span>Smart Buildings<br>Safer People</span></div></div>
    <nav aria-label="Primary navigation">
      @for (item of items; track item.route) {
        <a [routerLink]="item.route" routerLinkActive="active" (click)="navigate.emit()"><span class="nav-icon">{{item.icon}}</span>{{item.label}}</a>
      }
    </nav>
    <div class="sidebar-bottom"><div class="system"><b>System Status</b><span><i></i>All Systems Operational</span></div><small>v1.0.0</small></div>
  `,
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Output() navigate = new EventEmitter<void>();
  readonly items = [
    {label:'Dashboard',icon:'⌂',route:'/dashboard'}, {label:'Buildings',icon:'▥',route:'/buildings'}, {label:'Floor Monitoring',icon:'⌘',route:'/monitoring'},
    {label:'Spaces',icon:'⌂',route:'/spaces'}, {label:'Devices',icon:'◉',route:'/devices'}, {label:'Alerts',icon:'△',route:'/alerts'},
    {label:'Incidents',icon:'◷',route:'/incidents'}, {label:'Analytics',icon:'⌁',route:'/analytics'}, {label:'Settings',icon:'⚙',route:'/settings'}
  ];
}
