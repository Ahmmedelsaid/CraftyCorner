import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  model,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/ui/icon';
import { OrdersService } from '../../core/orders/orders.service';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * The customer picks the screenshot of their InstaPay transfer. It is uploaded at once (to a private place), and the
 * id the API gives back is what the order is placed with.
 */
@Component({
  selector: 'app-receipt-upload',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (preview(); as src) {
      <div class="flex items-center gap-4 rounded-xl border border-success/40 bg-success/5 p-3">
        <img
          [src]="src"
          alt=""
          class="size-20 shrink-0 rounded-lg border border-border object-cover"
        />
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-1.5 text-sm font-semibold text-success">
            <app-icon name="check" [size]="1" />
            {{ 'payment.uploaded' | transloco }}
          </p>
          <button type="button" class="mt-1 text-sm text-muted underline" (click)="remove()">
            {{ 'payment.remove' | transloco }}
          </button>
        </div>
      </div>
    } @else {
      <label
        class="grid cursor-pointer place-items-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-surface/60 px-4 py-7 text-center transition hover:border-accent/60 hover:bg-accent-soft/40"
        [class.pointer-events-none]="uploading()"
        [class.opacity-60]="uploading()"
      >
        <app-icon name="camera" [size]="1.8" class="text-accent" />
        <span class="text-sm font-semibold">
          {{ (uploading() ? 'payment.uploading' : 'payment.upload') | transloco }}
        </span>
        <span class="text-xs text-muted">{{ 'payment.uploadHint' | transloco }}</span>
        <input
          type="file"
          class="sr-only"
          accept="image/jpeg,image/png,image/webp"
          [disabled]="uploading()"
          (change)="onFile($event)"
        />
      </label>
    }

    @if (error(); as key) {
      <p role="alert" class="mt-2 text-sm text-danger">{{ key | transloco }}</p>
    }
  `,
})
export class ReceiptUpload {
  /** The id of the uploaded receipt (null until there is one). Two-way: [(receiptId)]. */
  readonly receiptId = model<string | null>(null);

  private readonly orders = inject(OrdersService);
  protected readonly preview = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release());
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.error.set(null);
    if (!TYPES.includes(file.type) || file.size > MAX_BYTES) {
      this.error.set('payment.uploadFailed');
      return;
    }

    this.uploading.set(true);
    this.orders.uploadReceipt(file).subscribe({
      next: ({ receiptId }) => {
        this.release();
        this.preview.set(URL.createObjectURL(file));
        this.receiptId.set(receiptId);
        this.uploading.set(false);
      },
      error: () => {
        this.uploading.set(false);
        this.error.set('payment.uploadFailed');
      },
    });
  }

  protected remove(): void {
    this.release();
    this.preview.set(null);
    this.receiptId.set(null);
  }

  private release(): void {
    const current = this.preview();
    if (current) URL.revokeObjectURL(current);
  }
}
