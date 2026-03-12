import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { UsersComponent } from './pages/users/users.component';
import { ListingsComponent } from './pages/listings/listings.component';

/* 
Admin layout wrapper.
This component provides the persistent admin UI
(nav bar, sidebar, etc). The router outlet inside AdminLayout will render the child admin pages. 
*/
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';

// Routes for the admin section.
// This file is lazy loaded when the user navigates to /admin.
export const ADMIN_ROUTES: Routes = [
  /* 
  Redirect /admin → /admin/login
  This keeps login outside the admin layout.
  */
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },

  /* 
  Admin login page.
  This does NOT use the AdminLayout because we do not
  want the admin navigation visible before login.
  */
  {
    path: 'login',
    component: LoginComponent,
  },

  /* 
  AdminLayout becomes the parent route.
  All admin pages inside "children" will render
  inside the router-outlet of AdminLayout.
  */

  {
    path: '',
    component: AdminLayoutComponent,

    children: [
      /* Admin dashboard */
      {
        path: 'dashboard',
        component: DashboardComponent,
      },

      /* User management page */
      {
        path: 'users',
        component: UsersComponent,
      },

      /* Property listings management */
      {
        path: 'listings',
        component: ListingsComponent,
      },
    ],
  },
];
