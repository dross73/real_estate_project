import { CurrencyPipe } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { ListingPreview } from '../../models/public-listing';

interface MortgageEstimate {
  loanAmount: number;
  principalAndInterest: number;
  propertyTax: number;
  insurance: number;
  hoa: number;
  total: number;
}

@Component({
  selector: 'app-listing-tools',
  imports: [CurrencyPipe, ReactiveFormsModule],
  templateUrl: './listing-tools.component.html',
  styleUrl: './listing-tools.component.css',
})
export class ListingToolsComponent implements OnChanges {
  @Input({ required: true }) listing!: ListingPreview;

  shareStatus = '';
  shareError = '';

  readonly mortgageForm = new FormGroup({
    homePrice: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    downPayment: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    interestRate: new FormControl(6.5, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100)],
    }),
    termYears: new FormControl(30, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(50)],
    }),
    annualPropertyTax: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    annualInsurance: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    monthlyHoa: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['listing']?.currentValue) {
      this.applyListingDefaults();
    }
  }

  get canNativeShare(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    );
  }

  get shareUrl(): string {
    const path = `/listings/${this.listing.id}`;

    if (typeof window === 'undefined') {
      return path;
    }

    return new URL(path, window.location.origin).toString();
  }

  get emailShareHref(): string {
    const subject = `Take a look at ${this.listing.title}`;
    const body = `${this.listing.title}\n${this.shareUrl}`;

    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  get smsShareHref(): string {
    const body = `Take a look at ${this.listing.title}: ${this.shareUrl}`;
    return `sms:?body=${encodeURIComponent(body)}`;
  }

  get facebookShareHref(): string {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.shareUrl)}`;
  }

  get xShareHref(): string {
    const text = `Take a look at ${this.listing.title}`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(this.shareUrl)}`;
  }

  get mortgageEstimate(): MortgageEstimate {
    const values = this.mortgageForm.getRawValue();

    const homePrice = this.nonNegative(values.homePrice);
    const downPayment = Math.min(
      this.nonNegative(values.downPayment),
      homePrice,
    );
    const loanAmount = homePrice - downPayment;
    const termMonths = Math.max(1, Math.round(values.termYears * 12));
    const monthlyRate =
      this.nonNegative(values.interestRate) / 100 / 12;

    let principalAndInterest = 0;

    if (loanAmount > 0) {
      if (monthlyRate === 0) {
        principalAndInterest = loanAmount / termMonths;
      } else {
        const factor = Math.pow(1 + monthlyRate, termMonths);
        principalAndInterest =
          loanAmount * ((monthlyRate * factor) / (factor - 1));
      }
    }

    const propertyTax =
      this.nonNegative(values.annualPropertyTax) / 12;
    const insurance =
      this.nonNegative(values.annualInsurance) / 12;
    const hoa = this.nonNegative(values.monthlyHoa);

    return {
      loanAmount,
      principalAndInterest,
      propertyTax,
      insurance,
      hoa,
      total:
        principalAndInterest +
        propertyTax +
        insurance +
        hoa,
    };
  }

  async shareListing(): Promise<void> {
    if (!this.canNativeShare) {
      await this.copyListingLink();
      return;
    }

    this.shareStatus = '';
    this.shareError = '';

    try {
      await navigator.share({
        title: this.listing.title,
        text: `Take a look at ${this.listing.title}`,
        url: this.shareUrl,
      });
      this.shareStatus = 'Share options opened.';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      this.shareError = 'Unable to open sharing options right now.';
    }
  }

  async copyListingLink(): Promise<void> {
    this.shareStatus = '';
    this.shareError = '';

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.shareUrl);
      } else {
        this.copyWithFallback(this.shareUrl);
      }

      this.shareStatus = 'Listing link copied.';
    } catch {
      try {
        this.copyWithFallback(this.shareUrl);
        this.shareStatus = 'Listing link copied.';
      } catch {
        this.shareError = 'Unable to copy the listing link.';
      }
    }
  }

  private applyListingDefaults(): void {
    const homePrice = this.listing.price ?? 0;

    this.mortgageForm.setValue({
      homePrice,
      downPayment: Math.round(homePrice * 0.2),
      interestRate: 6.5,
      termYears: 30,
      annualPropertyTax: this.listing.annual_property_taxes ?? 0,
      annualInsurance: 0,
      monthlyHoa: this.monthlyHoaFromListing(),
    });
  }

  private monthlyHoaFromListing(): number {
    const fee = this.listing.hoa_fee ?? 0;

    if (!fee) {
      return 0;
    }

    if (this.listing.hoa_fee_frequency === 'Quarterly') {
      return fee / 3;
    }

    if (this.listing.hoa_fee_frequency === 'Annually') {
      return fee / 12;
    }

    return fee;
  }

  private nonNegative(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  private copyWithFallback(value: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error('Copy command failed');
    }
  }
}
