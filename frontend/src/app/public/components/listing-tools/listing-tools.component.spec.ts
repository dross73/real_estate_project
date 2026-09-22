import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListingPreview } from '../../models/public-listing';
import { ListingToolsComponent } from './listing-tools.component';

describe('ListingToolsComponent', () => {
  let fixture: ComponentFixture<ListingToolsComponent>;
  let component: ListingToolsComponent;

  const listing: ListingPreview = {
    id: 27,
    title: 'Warm Craftsman Near Downtown',
    status: 'Active',
    is_featured: false,
    hide_exact_address: false,
    price: 400000,
    property_type: 'Single Family',
    address: '123 Main St',
    city: 'Ames',
    state: 'IA',
    description: null,
    sqft: 1800,
    acreage: null,
    year_built: 2000,
    bedrooms: 3,
    bathrooms: 2,
    annual_property_taxes: 4800,
    hoa_fee: 900,
    hoa_fee_frequency: 'Quarterly',
    school_district: null,
    amenities: [],
    mls_number: null,
    source_attribution: null,
    cover_image: null,
    open_houses: [],
    created_at: null,
    updated_at: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListingToolsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ListingToolsComponent);
    component = fixture.componentInstance;
    component.listing = listing;
    component.ngOnChanges({
      listing: new SimpleChange(undefined, listing, true),
    });
    fixture.detectChanges();
  });

  it('should seed the calculator from listing data', () => {
    const values = component.mortgageForm.getRawValue();

    expect(values.homePrice).toBe(400000);
    expect(values.downPayment).toBe(80000);
    expect(values.annualPropertyTax).toBe(4800);
    expect(values.monthlyHoa).toBe(300);
    expect(values.termYears).toBe(30);
  });

  it('should calculate principal, taxes, insurance, hoa, and total', () => {
    component.mortgageForm.setValue({
      homePrice: 400000,
      downPayment: 80000,
      interestRate: 6,
      termYears: 30,
      annualPropertyTax: 4800,
      annualInsurance: 1200,
      monthlyHoa: 300,
    });

    const estimate = component.mortgageEstimate;

    expect(estimate.loanAmount).toBe(320000);
    expect(estimate.principalAndInterest).toBeCloseTo(1918.56, 1);
    expect(estimate.propertyTax).toBe(400);
    expect(estimate.insurance).toBe(100);
    expect(estimate.hoa).toBe(300);
    expect(estimate.total).toBeCloseTo(2718.56, 1);
  });

  it('should support a zero-interest loan estimate', () => {
    component.mortgageForm.setValue({
      homePrice: 120000,
      downPayment: 0,
      interestRate: 0,
      termYears: 10,
      annualPropertyTax: 0,
      annualInsurance: 0,
      monthlyHoa: 0,
    });

    expect(component.mortgageEstimate.principalAndInterest).toBe(1000);
    expect(component.mortgageEstimate.total).toBe(1000);
  });

  it('should create copy, email, text, and social share destinations', () => {
    expect(component.shareUrl).toContain('/listings/27');
    expect(component.emailShareHref).toContain('mailto:');
    expect(component.emailShareHref).toContain('Warm%20Craftsman');
    expect(component.smsShareHref).toContain('sms:');
    expect(component.facebookShareHref).toContain('facebook.com');
    expect(component.xShareHref).toContain('twitter.com');
  });

  it('should convert annual hoa data to a monthly default', () => {
    const annualListing: ListingPreview = {
      ...listing,
      hoa_fee: 1200,
      hoa_fee_frequency: 'Annually',
    };

    component.listing = annualListing;
    component.ngOnChanges({
      listing: new SimpleChange(listing, annualListing, false),
    });

    expect(component.mortgageForm.controls.monthlyHoa.value).toBe(100);
  });
});
