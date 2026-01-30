import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // When the user navigates to /admin,
    // Angular will lazy load the admin route configuration
    // instead of bundling it with the main application.
    //
    // This keeps the initial bundle size smaller and faster.
    path: 'admin',

    // loadChildren tells Angular to dynamically import
    // the admin routing file only when /admin is accessed.
    loadChildren: () =>
      import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
];
