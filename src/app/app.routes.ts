import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/today/today.component').then((m) => m.TodayComponent),
      },
      {
        path: 'add',
        loadComponent: () =>
          import('./features/add-food/add-food.component').then((m) => m.AddFoodComponent),
      },
      {
        path: 'scan',
        loadComponent: () =>
          import('./features/scan/scan.component').then((m) => m.ScanComponent),
      },
      {
        path: 'targets',
        loadComponent: () =>
          import('./features/targets/targets.component').then((m) => m.TargetsComponent),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics.component').then((m) => m.AnalyticsComponent),
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./features/history/history.component').then((m) => m.HistoryComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
