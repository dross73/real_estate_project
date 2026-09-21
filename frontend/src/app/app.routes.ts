import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // Keep the existing admin application isolated and lazy loaded.
    path: 'admin',
    loadChildren: () =>
      import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    // All non-admin routes use the public-site route configuration.
    path: '',
    loadChildren: () =>
      import('./public/public.routes').then((m) => m.PUBLIC_ROUTES),
  },
];
