import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Shows a payment receipt. Receipts are private, so the image cannot be a plain `<img src>` (that request carries no
 * sign-in): it is fetched through the API with the user's token, and shown from a temporary local address.
 */
@Component({
  selector: 'app-receipt-image',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (address(); as src) {
      <a
        [href]="src"
        target="_blank"
        rel="noopener"
        class="block overflow-hidden rounded-xl border border-border bg-surface-2/50"
      >
        <img
          [src]="src"
          [alt]="'payment.receiptAlt' | transloco"
          class="max-h-72 w-full object-contain"
        />
      </a>
    } @else if (failed()) {
      <p class="rounded-xl bg-surface-2/60 px-3 py-4 text-center text-sm text-muted">
        {{ 'payment.receiptMissing' | transloco }}
      </p>
    } @else {
      <div class="h-40 skeleton rounded-xl" aria-hidden="true"></div>
    }
  `,
})
export class ReceiptImage {
  /** API address of the receipt, for example `/api/orders/12/receipt`. */
  readonly url = input.required<string>();

  private readonly http = inject(HttpClient);
  protected readonly address = signal<string | null>(null);
  protected readonly failed = signal(false);

  constructor() {
    effect((onCleanup) => {
      const url = this.url();
      this.address.set(null);
      this.failed.set(false);

      const request = this.http.get(url, { responseType: 'blob' }).subscribe({
        next: (blob) => this.address.set(URL.createObjectURL(blob)),
        error: () => this.failed.set(true),
      });
      onCleanup(() => request.unsubscribe());
    });

    inject(DestroyRef).onDestroy(() => {
      const current = this.address();
      if (current) URL.revokeObjectURL(current);
    });
  }
}
