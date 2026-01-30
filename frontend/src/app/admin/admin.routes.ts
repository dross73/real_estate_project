import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component'; 
import { UsersComponent } from './pages/users/users.component';
import { ListingsComponent } from './pages/listings/listings.component';


// Routes for the admin section.
// This file is lazy loaded when the user navigates to /admin.
export const ADMIN_ROUTES: Routes = [
  // Redirect /admin to /admin/login as the default entry point
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },

  //Admin login page
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
  },
  {
    path: 'users',
    component: UsersComponent,
  },
  {
    path: 'listings',
    component: ListingsComponent,
  }

];
