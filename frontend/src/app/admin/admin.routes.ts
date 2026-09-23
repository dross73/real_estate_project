import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { UsersComponent } from './pages/users/users.component';
import { UserCreateComponent } from './pages/user-create/user-create.component';
import { UserEditComponent } from './pages/user-edit/user-edit.component';
import { ListingsComponent } from './pages/listings/listings.component';
import { SiteSettingsComponent } from './pages/site-settings/site-settings.component';
import { AgentsComponent } from './pages/agents/agents.component';
import { AgentFormComponent } from './pages/agent-form/agent-form.component';
import { OfficesComponent } from './pages/offices/offices.component';
import { OfficeFormComponent } from './pages/office-form/office-form.component';
import { LeadsComponent } from './pages/leads/leads.component';
import { LeadDetailComponent } from './pages/lead-detail/lead-detail.component';
import { TestimonialsComponent } from './pages/testimonials/testimonials.component';
import { TestimonialFormComponent } from './pages/testimonial-form/testimonial-form.component';

import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { ListingCreateComponent } from './pages/listing-create/listing-create.component';
import { ListingDetailsComponent } from './pages/listing-details/listing-details.component';
import { ListingEditComponent } from './pages/listing-edit/listing-edit.component';

import { authGuard } from '../guards/auth.guard';

import { adminGuard } from '../guards/admin.guard';

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
    canActivate: [authGuard],

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
        canActivate: [adminGuard],
      },

      /* Create user page */
      {
        path: 'users/create',
        component: UserCreateComponent,
        canActivate: [adminGuard],
      },

      /* Edit user page */
      {
        path: 'users/:id/edit',
        component: UserEditComponent,
        canActivate: [adminGuard],
      },

      /* Admin-managed agent profiles */
      {
        path: 'agents',
        component: AgentsComponent,
        canActivate: [adminGuard],
      },
      {
        path: 'agents/create',
        component: AgentFormComponent,
        canActivate: [adminGuard],
      },
      {
        path: 'agents/:id/edit',
        component: AgentFormComponent,
        canActivate: [adminGuard],
      },

      /* Admin-managed brokerage offices */
      {
        path: 'offices',
        component: OfficesComponent,
        canActivate: [adminGuard],
      },
      {
        path: 'offices/create',
        component: OfficeFormComponent,
        canActivate: [adminGuard],
      },
      {
        path: 'offices/:id/edit',
        component: OfficeFormComponent,
        canActivate: [adminGuard],
      },

      /* Admin-managed brokerage and public-site configuration */
      {
        path: 'settings/site',
        component: SiteSettingsComponent,
        canActivate: [adminGuard],
      },

      /* Staff/admin lead and inquiry management */
      {
        path: 'leads',
        component: LeadsComponent,
      },
      {
        path: 'leads/:id',
        component: LeadDetailComponent,
      },

      /* Staff/admin testimonial moderation */
      {
        path: 'testimonials',
        component: TestimonialsComponent,
      },
      {
        path: 'testimonials/create',
        component: TestimonialFormComponent,
      },
      {
        path: 'testimonials/:id/edit',
        component: TestimonialFormComponent,
      },

      /* Property listings management */
      {
        path: 'listings',
        component: ListingsComponent,
      },

      {
        path: 'listings/create',
        component: ListingCreateComponent,
      },

      /* Listing edit page */
      {
        path: 'listings/:id/edit',
        component: ListingEditComponent,
      },

      /* Listing details page */
      {
        path: 'listings/:id',
        component: ListingDetailsComponent,
      },
    ],
  },
];
