import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BehaviorSubject, combineLatest, switchMap } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from '@shared/core/auth/auth.service';
import { ReviewSummary } from '@shared/core/models/api.models';
import { LoadState, toLoadState } from '@shared/core/state/load-state';
import { ToastService } from '@shared/core/toast/toast.service';
import { DateTimePipe } from '@shared/pipes/date-time.pipe';
import { Icon } from '@shared/ui/icon';
import { Stars } from '@shared/ui/stars';

/** Ratings and reviews of one product, plus the form for a customer who received it. */
@Component({
  selector: 'app-product-reviews',
  imports: [FormsModule, RouterLink, TranslocoPipe, DateTimePipe, Icon, Stars],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="reviews-title" class="grid gap-5">
      <h2 id="reviews-title" class="font-semibold">{{ 'reviews.title' | transloco }}</h2>

      @let current = state();
      @if (current.status === 'ready') {
        @let summary = current.data;

        @if (summary.count > 0) {
          <div
            class="grid items-center gap-5 rounded-2xl border border-border bg-surface/60 p-5 sm:grid-cols-[auto_1fr]"
          >
            <div class="text-center sm:px-4">
              <p class="text-4xl font-bold tabular-nums">{{ summary.average.toFixed(1) }}</p>
              <app-stars [value]="summary.average" [size]="1.1" />
              <p class="mt-1 text-xs text-muted">
                {{ 'reviews.count' | transloco: { count: summary.count } }}
              </p>
            </div>
            <ul class="grid gap-1.5 text-xs" aria-hidden="true">
              @for (star of [5, 4, 3, 2, 1]; track star) {
                <li class="flex items-center gap-2">
                  <span class="w-3 tabular-nums">{{ star }}</span>
                  <span class="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span
                      class="block h-full rounded-full bg-highlight"
                      [style.width.%]="(summary.distribution[star - 1] / summary.count) * 100"
                    ></span>
                  </span>
                  <span class="w-5 text-end tabular-nums text-muted">
                    {{ summary.distribution[star - 1] }}
                  </span>
                </li>
              }
            </ul>
          </div>
        } @else {
          <p class="text-sm text-muted">{{ 'reviews.none' | transloco }}</p>
        }

        @if (!auth.isAuthenticated()) {
          <p class="text-sm text-muted">
            <a routerLink="/login" class="font-semibold text-accent hover:underline">
              {{ 'reviews.signIn' | transloco }}
            </a>
          </p>
        } @else if (summary.canReview) {
          <form
            class="grid gap-3 rounded-2xl border border-border bg-surface p-5"
            (ngSubmit)="submit()"
          >
            <p class="text-sm font-semibold">{{ 'reviews.yourRating' | transloco }}</p>
            <div
              class="flex gap-1"
              role="radiogroup"
              [attr.aria-label]="'reviews.yourRating' | transloco"
            >
              @for (star of [1, 2, 3, 4, 5]; track star) {
                <button
                  type="button"
                  role="radio"
                  class="transition hover:scale-110"
                  [class.text-highlight]="star <= rating()"
                  [class.text-border]="star > rating()"
                  [attr.aria-checked]="star === rating()"
                  [attr.aria-label]="star + ' / 5'"
                  (click)="rating.set(star)"
                >
                  <app-icon name="star" [size]="1.7" />
                </button>
              }
            </div>
            <textarea
              class="field"
              rows="3"
              maxlength="1000"
              name="comment"
              [ngModel]="comment()"
              (ngModelChange)="comment.set($event)"
              [placeholder]="'reviews.commentPlaceholder' | transloco"
            ></textarea>
            <button
              type="submit"
              class="btn btn-accent justify-self-start"
              [disabled]="rating() === 0 || saving()"
            >
              {{ 'reviews.submit' | transloco }}
            </button>
          </form>
        } @else {
          <p class="text-sm text-muted">{{ 'reviews.afterDelivery' | transloco }}</p>
        }

        @if (summary.items.length) {
          <ul class="grid gap-3">
            @for (review of summary.items; track review.id) {
              <li class="rounded-2xl border border-border bg-surface/60 p-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="flex items-center gap-2 text-sm font-semibold">
                    <span
                      class="grid size-7 place-items-center rounded-full bg-accent text-xs font-bold text-accent-fg"
                      aria-hidden="true"
                      >{{ review.authorName.charAt(0) }}</span
                    >
                    {{ review.authorName }}
                    <app-stars [value]="review.rating" [size]="0.9" />
                  </p>
                  <span class="text-xs text-muted">{{ review.createdAt | dateTime }}</span>
                </div>
                @if (review.comment) {
                  <p class="mt-2 text-sm leading-relaxed">{{ review.comment }}</p>
                }
                @if (review.isMine) {
                  <button
                    type="button"
                    class="mt-2 text-xs text-muted underline"
                    (click)="remove()"
                  >
                    {{ 'reviews.delete' | transloco }}
                  </button>
                }
              </li>
            }
          </ul>
        }
      } @else if (current.status === 'loading') {
        <div class="h-24 skeleton rounded-2xl" aria-hidden="true"></div>
      }
    </section>
  `,
})
export class ProductReviews {
  readonly productId = input.required<number>();
  protected readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  protected readonly rating = signal(0);
  protected readonly comment = signal('');
  protected readonly saving = signal(false);

  protected readonly state = toSignal(
    combineLatest([
      toObservable(this.productId),
      this.reload$,
      toObservable(computed(() => this.auth.user()?.id ?? 0)),
    ]).pipe(
      switchMap(([id]) =>
        this.http
          .get<ReviewSummary>(`${environment.apiUrl}/products/${id}/reviews`)
          .pipe(toLoadState()),
      ),
    ),
    { initialValue: { status: 'loading' } as LoadState<ReviewSummary> },
  );

  protected submit(): void {
    if (this.rating() === 0) return;
    this.saving.set(true);
    this.http
      .put<void>(`${environment.apiUrl}/products/${this.productId()}/reviews`, {
        rating: this.rating(),
        comment: this.comment().trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.rating.set(0);
          this.comment.set('');
          this.toasts.show({ kind: 'success', key: 'reviews.thanks' });
          this.reload$.next();
        },
        error: () => {
          this.saving.set(false);
          this.toasts.show({ kind: 'error', key: 'reviews.failed' });
        },
      });
  }

  protected remove(): void {
    this.http.delete<void>(`${environment.apiUrl}/products/${this.productId()}/reviews`).subscribe({
      next: () => this.reload$.next(),
      error: () => this.toasts.show({ kind: 'error', key: 'reviews.failed' }),
    });
  }
}
