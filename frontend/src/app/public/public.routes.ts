import { Routes } from '@angular/router';

import { PublicLayoutComponent } from './components/public-layout/public-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { PublicListingsComponent } from './pages/listings/public-listings.component';
import { PublicPlaceholderComponent } from './pages/public-placeholder/public-placeholder.component';
import { ListingDetailComponent } from './pages/listing-detail/listing-detail.component';
import { SavedHomesComponent } from './pages/saved-homes/saved-homes.component';

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
        path: 'listings/:id',
        component: ListingDetailComponent,
      },
      {
        path: 'listings',
        component: PublicListingsComponent,
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
        component: PublicPlaceholderComponent,
        data: {
          title: 'Sign In',
          message:
            'Public account authentication UI will be connected in later account tickets.',
        },
      },
    ],
  },
];
