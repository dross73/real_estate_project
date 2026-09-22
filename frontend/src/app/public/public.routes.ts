import { Routes } from '@angular/router';

import { authGuard } from '../guards/auth.guard';
import { publicUserGuard } from '../guards/public-user.guard';

import { PublicLayoutComponent } from './components/public-layout/public-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { PublicListingsComponent } from './pages/listings/public-listings.component';
import { PublicPlaceholderComponent } from './pages/public-placeholder/public-placeholder.component';
import { ListingDetailComponent } from './pages/listing-detail/listing-detail.component';
import { SavedHomesComponent } from './pages/saved-homes/saved-homes.component';
import { PublicLoginComponent } from './pages/public-login/public-login.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { AccountSettingsComponent } from './pages/account-settings/account-settings.component';
import { AgentProfileComponent } from './pages/agent-profile/agent-profile.component';

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
        component: PublicPlaceholderComponent,
        data: {
          title: 'About Juniper & Lane',
          message:
            'This optional public page has a route ready for future content.',
        },
      },
      {
        path: 'contact',
        component: PublicPlaceholderComponent,
        data: {
          title: 'Contact Juniper & Lane',
          message:
            'This optional public page has a route ready for future content.',
        },
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
    ],
  },
];
