import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BehaviorSubject, combineLatest, switchMap } from 'rxjs';
import { AdminProductRow } from '../data/admin.models';
import { AdminService } from '../data/admin.service';
import { PagedResult } from '@web/core/models/api.models';
import { LoadState, toLoadState } from '@web/core/state/load-state';
import { ToastService } from '@web/core/toast/toast.service';
import { PricePipe } from '@web/shared/pipes/price.pipe';

/** كل المنتجات (حتى المخفية): بحث، فلتر، تعديل، وإخفاء. */
@Component({
  selector: 'app-admin-products',
  imports: [RouterLink, TranslocoPipe, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <a routerLink="/products/new" class="btn btn-accent"
        >+ {{ 'admin.products.add' | transloco }}</a
      >
      <div class="flex flex-wrap gap-2">
        @for (filter of filters; track filter.key) {
          <a
            routerLink="/products"
            [queryParams]="{ active: filter.value, search: params().search }"
            class="rounded-full border px-3.5 py-1.5 text-sm transition"
            [class]="
              params().active === filter.value
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-border bg-surface'
            "
          >
            {{ 'admin.products.filter.' + filter.key | transloco }}
          </a>
        }
      </div>
    </div>

    <form class="mb-5 flex gap-2" (submit)="search($event, q.value)">
      <input
        #q
        type="search"
        class="field"
        [value]="params().search ?? ''"
        [placeholder]="'admin.products.searchPlaceholder' | transloco"
        [attr.aria-label]="'admin.products.searchPlaceholder' | transloco"
      />
      <button type="submit" class="btn btn-accent">{{ 'admin.search' | transloco }}</button>
    </form>

    @let current = state();
    @if (current.status === 'ready') {
      @if (current.data.items.length === 0) {
        <p class="card p-8 text-center text-muted">{{ 'admin.products.empty' | transloco }}</p>
      } @else {
        <ul class="grid gap-3">
          @for (product of current.data.items; track product.id) {
            <li
              class="card grid gap-3 p-3 sm:flex sm:flex-wrap sm:items-center"
              [class.opacity-60]="!product.isActive"
            >
              <div class="flex items-center gap-3 sm:min-w-0 sm:flex-1">
                <div class="arch size-16 shrink-0 !rounded-[999px_999px_0.7rem_0.7rem]">
                  @if (product.imageUrl) {
                    <img [src]="product.imageUrl" alt="" />
                  }
                </div>
                <div class="min-w-0 flex-1">
                  <a
                    [routerLink]="['/products', product.id]"
                    class="block font-semibold hover:text-accent"
                  >
                    {{ product.name }}
                  </a>
                  <p class="text-xs text-muted">{{ product.categoryName }} · {{ product.sku }}</p>
                  @if (!product.isActive) {
                    <span
                      class="mt-1 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold"
                    >
                      {{ 'admin.products.hidden' | transloco }}
                    </span>
                  }
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-bold text-accent-hover">{{ product.price | price }}</span>
                <span
                  class="rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums"
                  [class]="
                    product.stockQuantity === 0
                      ? 'bg-danger/15 text-danger'
                      : product.stockQuantity <= 3
                        ? 'bg-highlight/25 text-highlight-strong'
                        : 'bg-surface-2'
                  "
                >
                  {{ 'admin.products.stock' | transloco }}: {{ product.stockQuantity }}
                </span>
                <a [routerLink]="['/products', product.id]" class="btn !py-1.5">{{
                  'admin.edit' | transloco
                }}</a>
                @if (product.isActive) {
                  @if (hidingId() === product.id) {
                    <button
                      type="button"
                      class="btn !border-danger !py-1.5 !text-danger"
                      (click)="hide(product)"
                    >
                      {{ 'admin.products.hideSure' | transloco }}
                    </button>
                  } @else {
                    <button type="button" class="btn !py-1.5" (click)="hidingId.set(product.id)">
                      {{ 'admin.products.hide' | transloco }}
                    </button>
                  }
                }
              </div>
            </li>
          }
        </ul>

        @if (current.data.totalPages > 1) {
          <div class="mt-5 flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              class="btn"
              [disabled]="current.data.page <= 1"
              (click)="go(current.data.page - 1)"
            >
              {{ 'pagination.prev' | transloco }}
            </button>
            <span class="tabular-nums"
              >{{ current.data.page }} / {{ current.data.totalPages }}</span
            >
            <button
              type="button"
              class="btn"
              [disabled]="current.data.page >= current.data.totalPages"
              (click)="go(current.data.page + 1)"
            >
              {{ 'pagination.next' | transloco }}
            </button>
          </div>
        }
      }
    } @else if (current.status === 'loading') {
      <div class="grid gap-3" aria-hidden="true">
        <div class="card skeleton h-20"></div>
        <div class="card skeleton h-20"></div>
      </div>
    } @else {
      <p class="card p-6 text-danger" role="alert">{{ 'admin.loadError' | transloco }}</p>
    }
  `,
})
export class AdminProducts {
  private readonly admin = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly filters = [
    { key: 'all', value: undefined },
    { key: 'active', value: 'true' },
    { key: 'hidden', value: 'false' },
  ];
  protected readonly hidingId = signal<number | null>(null);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly params = computed(() => {
    const q = this.queryParams();
    return {
      search: q.get('search') ?? undefined,
      active: q.get('active') ?? undefined,
      page: Number(q.get('page')) > 0 ? Number(q.get('page')) : 1,
    };
  });

  protected readonly state = toSignal(
    combineLatest([toObservable(this.params), this.reload$]).pipe(
      switchMap(([p]) =>
        this.admin
          .products({
            search: p.search,
            active: p.active === undefined ? undefined : p.active === 'true',
            page: p.page,
            pageSize: 20,
          })
          .pipe(toLoadState()),
      ),
    ),
    { initialValue: { status: 'loading' } as LoadState<PagedResult<AdminProductRow>> },
  );

  protected search(event: Event, value: string): void {
    event.preventDefault();
    void this.router.navigate([], {
      queryParams: { search: value.trim() || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected go(page: number): void {
    void this.router.navigate([], { queryParams: { page }, queryParamsHandling: 'merge' });
  }

  protected hide(product: AdminProductRow): void {
    this.admin.hideProduct(product.id).subscribe({
      next: () => {
        this.hidingId.set(null);
        this.toasts.show({ kind: 'success', key: 'admin.products.hiddenDone' });
        this.reload$.next();
      },
      error: () => this.toasts.show({ kind: 'error', key: 'admin.saveFailed' }),
    });
  }
}
