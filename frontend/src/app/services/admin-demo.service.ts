import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AdminDemoService {
  readonly blocked = signal(false);
  readonly message = 'Demo Mode — Changes are disabled.';
  notify(): void { this.blocked.set(true); }
  clear(): void { this.blocked.set(false); }
}
