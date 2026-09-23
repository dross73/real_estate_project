import { Routes } from '@angular/router';

import { authGuard } from '../guards/auth.guard';
import { publicUserGuard } from '../guards/public-user.guard';

import { PublicLayoutComponent } from './components/public-layout/public-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { PublicListingsComponent } from './pages/listings/public-listings.component';
import { ListingDetailComponent } from './pages/listing-detail/listing-detail.component';
import { SavedHomesComponent } from './pages/saved-homes/saved-homes.component';
import { PublicLoginComponent } from './pages/public-login/public-login.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { AccountSettingsComponent } from './pages/account-settings/account-settings.component';
import { AgentProfileComponent } from './pages/agent-profile/agent-profile.component';
import { PublicDashboardComponent } from './pages/public-dashboard/public-dashboard.component';
import { PublicContactComponent } from './pages/public-contact/public-contact.component';
import { TestimonialSubmitComponent } from './pages/testimonial-submit/testimonial-submit.component';
import { PublicAboutComponent } from './pages/public-about/public-about.component';
import { PublicLegalPageComponent } from './pages/public-legal-page/public-legal-page.component';

// Public routes stay separate from the existing /admin application.
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        component: HomeComponent,
      },
      {
        path: 'preview/listings/:id',
        component: ListingDetailComponent,
        canActivate: [authGuard],
        data: { preview: true },
      },
      {
        path: 'listings/:id',
        component: ListingDetailComponent,
      },
      {
        path: 'listings',
        component: PublicListingsComponent,
      },
      {
        path: 'agents/:id',
        component: AgentProfileComponent,
      },
      {
        path: 'about',
        component: PublicAboutComponent,
      },
      {
        path: 'contact',
        component: PublicContactComponent,
      },
      {
        path: 'privacy',
        component: PublicLegalPageComponent,
        data: { page: 'privacy' },
      },
      {
        path: 'terms',
        component: PublicLegalPageComponent,
        data: { page: 'terms' },
      },
      {
        path: 'account',
        component: PublicDashboardComponent,
        canActivate: [publicUserGuard],
      },
      {
        path: 'account/saved',
        component: SavedHomesComponent,
      },
      {
        path: 'account/login',
        component: PublicLoginComponent,
      },
      {
        path: 'account/forgot-password',
        component: ForgotPasswordComponent,
      },
      {
        path: 'account/reset-password',
        component: ResetPasswordComponent,
      },
      {
        path: 'account/settings',
        component: AccountSettingsComponent,
        canActivate: [publicUserGuard],
      },
      {
        path: 'account/testimonial',
        component: TestimonialSubmitComponent,
        canActivate: [publicUserGuard],
      },
    ],
  },
];
