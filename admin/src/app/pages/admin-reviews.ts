import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { BehaviorSubject, switchMap } from 'rxjs';
import { PagedResult } from '@shared/core/models/api.models';
import { LoadState, toLoadState } from '@shared/core/state/load-state';
import { ToastService } from '@shared/core/toast/toast.service';
import { DateTimePipe } from '@shared/pipes/date-time.pipe';
import { Icon } from '@shared/ui/icon';
import { AdminReview } from '../data/admin.models';
import { AdminService } from '../data/admin.service';

/** كل تقييمات العملاء: الأحدث أولاً، وتقدر تمسح أي تقييم مش مناسب. */
@Component({
  selector: 'app-admin-reviews',
  imports: [TranslocoPipe, DateTimePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="mb-5 max-w-xl text-sm text-muted">{{ 'admin.reviews.intro' | transloco }}</p>

    @let current = state();
    @if (current.status === 'loading') {
      <div class="card skeleton h-40"></div>
    } @else if (current.status === 'error') {
      <p class="card p-6 text-danger" role="alert">{{ 'admin.loadError' | transloco }}</p>
    } @else if (current.data.items.length === 0) {
      <p class="card p-8 text-center text-muted">{{ 'admin.reviews.empty' | transloco }}</p>
    } @else {
      <ul class="card divide-y divide-border">
        @for (review of current.data.items; track review.id) {
          <li class="flex flex-wrap items-start justify-between gap-3 p-4">
            <div class="min-w-0 flex-1">
              <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="font-semibold">{{ review.productName }}</span>
                <span class="inline-flex text-highlight" [attr.aria-label]="review.rating + ' / 5'">
                  @for (star of stars; track star) {
                    <app-icon name="star" [size]="0.95" [class.opacity-25]="star > review.rating" />
                  }
                </span>
              </p>
              @if (review.comment) {
                <p class="mt-1 text-sm">{{ review.comment }}</p>
              }
              <p class="mt-1 text-xs text-muted">
                {{ review.authorName }} · <bdi dir="ltr">{{ review.authorEmail }}</bdi> ·
                {{ review.createdAt | dateTime }}
              </p>
            </div>
            <button
              type="button"
              class="btn !py-1.5 text-danger"
              [disabled]="deletingId() === review.id"
              (click)="remove(review)"
            >
              <app-icon name="trash" [size]="1" />
              {{ 'admin.reviews.delete' | transloco }}
            </button>
          </li>
        }
      </ul>

      @if (current.data.totalPages > 1) {
        <nav class="mt-4 flex items-center justify-center gap-3 text-sm">
          <button type="button" class="btn" [disabled]="page() <= 1" (click)="goTo(page() - 1)">
            ‹
          </button>
          <span class="tabular-nums">{{ page() }} / {{ current.data.totalPages }}</span>
          <button
            type="button"
            class="btn"
            [disabled]="page() >= current.data.totalPages"
            (click)="goTo(page() + 1)"
          >
            ›
          </button>
        </nav>
      }
    }
  `,
})
export class AdminReviews {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);
  private readonly load$ = new BehaviorSubject<number>(1);

  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly page = signal(1);
  protected readonly deletingId = signal<number | null>(null);
  protected readonly state = toSignal(
    this.load$.pipe(switchMap((page) => this.admin.reviews(page).pipe(toLoadState()))),
    { initialValue: { status: 'loading' } as LoadState<PagedResult<AdminReview>> },
  );

  protected goTo(page: number): void {
    this.page.set(page);
    this.load$.next(page);
  }

  protected remove(review: AdminReview): void {
    this.deletingId.set(review.id);
    this.admin.deleteReview(review.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.toasts.show({ kind: 'success', key: 'admin.saved' });
        this.load$.next(this.page());
      },
      error: () => {
        this.deletingId.set(null);
        this.toasts.show({ kind: 'error', key: 'admin.saveFailed' });
      },
    });
  }
}
