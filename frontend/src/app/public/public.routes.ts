import { Routes } from '@angular/router';

import { PublicLayoutComponent } from './components/public-layout/public-layout.component';
import { PublicPlaceholderComponent } from './pages/public-placeholder/public-placeholder.component';

// Public routes stay separate from the existing /admin application.
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        component: PublicPlaceholderComponent,
        data: {
          title: 'Welcome to Juniper & Lane',
          message: 'The full public homepage will be built in KAN-59.',
        },
      },
      {
        path: 'listings',
        component: PublicPlaceholderComponent,
        data: {
          title: 'Homes in Our Community',
          message: 'The public listings experience will be built in KAN-60.',
        },
      },
      {
        path: 'about',
        component: PublicPlaceholderComponent,
        data: {
          title: 'About Juniper & Lane',
          message: 'This optional public page has a route ready for future content.',
        },
      },
      {
        path: 'contact',
        component: PublicPlaceholderComponent,
        data: {
          title: 'Contact Juniper & Lane',
          message: 'This optional public page has a route ready for future content.',
        },
      },
      {
        path: 'account/saved',
        component: PublicPlaceholderComponent,
        data: {
          title: 'Saved Homes',
          message: 'Public account experiences will be connected in later account tickets.',
        },
      },
      {
        path: 'account/login',
        component: PublicPlaceholderComponent,
        data: {
          title: 'Sign In',
          message: 'Public account authentication UI will be connected in later account tickets.',
        },
      },
    ],
  },
];
