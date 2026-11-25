import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BehaviorSubject, catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { Category, PagedResult } from '@web/core/models/api.models';
import { CatalogService } from '@web/core/services/catalog.service';
import { LoadState, toLoadState } from '@web/core/state/load-state';
import { ToastService } from '@web/core/toast/toast.service';
import { PricePipe } from '@web/shared/pipes/price.pipe';
import { Icon } from '@web/shared/ui/icon';
import { AdminProductRow } from '../data/admin.models';
import { AdminService } from '../data/admin.service';

/** كل المنتجات (حتى المخفية): بحث، فلتر بالحالة والتصنيف والمخزون، ترتيب، تعديل، وإخفاء. */
@Component({
  selector: 'app-admin-products',
  imports: [RouterLink, TranslocoPipe, PricePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex items-center justify-between gap-3">
      <p class="text-sm text-muted">
        @if (state(); as current) {
          @if (current.status === 'ready') {
            {{ 'admin.products.results' | transloco: { count: current.data.totalCount } }}
          }
        }
      </p>
      <a routerLink="/products/new" class="btn btn-accent">
        <app-icon name="plus" [size]="1" />
        {{ 'admin.products.add' | transloco }}
      </a>
    </div>

    <section class="card mb-5 grid gap-4 p-4">
      <form class="flex gap-2" (submit)="search($event, q.value)">
        <div class="relative flex-1">
          <app-icon
            name="search"
            [size]="1.1"
            class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            #q
            type="search"
            class="field !ps-10"
            [value]="params().search ?? ''"
            [placeholder]="'admin.products.searchPlaceholder' | transloco"
            [attr.aria-label]="'admin.products.searchPlaceholder' | transloco"
          />
        </div>
        <button type="submit" class="btn btn-accent">{{ 'admin.search' | transloco }}</button>
      </form>

      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-wrap gap-2">
          @for (filter of statusFilters; track filter.key) {
            <button
              type="button"
              class="rounded-full border px-3.5 py-1.5 text-sm transition"
              [class]="chip(params().active === filter.value)"
              (click)="set({ active: filter.value ?? null })"
            >
              {{ 'admin.products.filter.' + filter.key | transloco }}
            </button>
          }
        </div>

        <label class="grid gap-1 text-xs font-medium text-muted">
          {{ 'admin.products.category' | transloco }}
          <select
            class="field !w-auto"
            [value]="params().categoryId ?? ''"
            (change)="set({ categoryId: $any($event.target).value || null })"
          >
            <option value="">{{ 'admin.all' | transloco }}</option>
            @for (category of categories(); track category.id) {
              <option [value]="category.id" [selected]="params().categoryId === '' + category.id">
                {{ category.name }}
              </option>
            }
          </select>
        </label>

        <label class="grid gap-1 text-xs font-medium text-muted">
          {{ 'admin.products.stock' | transloco }}
          <select
            class="field !w-auto"
            (change)="set({ stock: $any($event.target).value || null })"
          >
            <option value="">{{ 'admin.all' | transloco }}</option>
            @for (option of stockFilters; track option) {
              <option [value]="option" [selected]="params().stock === option">
                {{ 'admin.products.stockFilter.' + option | transloco }}
              </option>
            }
          </select>
        </label>

        <label class="grid gap-1 text-xs font-medium text-muted">
          {{ 'admin.products.sortLabel' | transloco }}
          <select class="field !w-auto" (change)="set({ sort: $any($event.target).value || null })">
            @for (option of sorts; track option) {
              <option
                [value]="option === 'newest' ? '' : option"
                [selected]="(params().sort ?? 'newest') === option"
              >
                {{ 'admin.products.sort.' + option | transloco }}
              </option>
            }
          </select>
        </label>

        @if (hasFilters()) {
          <button type="button" class="btn !py-1.5 ms-auto text-xs" (click)="clear()">
            <app-icon name="x" [size]="0.9" />
            {{ 'admin.orders.clear' | transloco }}
          </button>
        }
      </div>
    </section>

    @let current = state();
    @if (current.status === 'ready') {
      @if (current.data.items.length === 0) {
        <p class="card p-10 text-center text-muted">{{ 'admin.products.empty' | transloco }}</p>
      } @else {
        <div class="card overflow-hidden">
          <table class="w-full text-sm">
            <thead
              class="hidden border-b border-border bg-surface-2/60 text-xs text-muted md:table-header-group"
            >
              <tr>
                <th class="px-4 py-3 text-start font-semibold">
                  {{ 'admin.products.col.product' | transloco }}
                </th>
                <th class="px-4 py-3 text-start font-semibold">
                  {{ 'admin.products.category' | transloco }}
                </th>
                <th class="px-4 py-3 text-end font-semibold">
                  {{ 'admin.products.col.price' | transloco }}
                </th>
                <th class="px-4 py-3 text-center font-semibold">
                  {{ 'admin.products.stock' | transloco }}
                </th>
                <th class="px-4 py-3 text-center font-semibold">
                  {{ 'admin.orders.col.status' | transloco }}
                </th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              @for (product of current.data.items; track product.id) {
                <tr
                  class="block px-4 py-3 md:table-row md:p-0"
                  [class.bg-surface-2/40]="!product.isActive"
                >
                  <td class="block md:table-cell md:px-4 md:py-3">
                    <div class="flex items-center gap-3">
                      <div
                        class="arch size-14 shrink-0 !rounded-[999px_999px_0.6rem_0.6rem]"
                        [class.opacity-50]="!product.isActive"
                      >
                        @if (product.imageUrl) {
                          <img [src]="product.imageUrl" alt="" />
                        }
                      </div>
                      <div class="min-w-0">
                        <a
                          [routerLink]="['/products', product.id]"
                          class="block truncate font-semibold hover:text-accent"
                        >
                          {{ product.name }}
                        </a>
                        <p class="text-xs text-muted" dir="ltr">{{ product.sku }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="hidden px-4 py-3 text-muted md:table-cell">
                    {{ product.categoryName }}
                  </td>
                  <td
                    class="inline-block pe-3 pt-2 font-bold text-accent-hover md:table-cell md:px-4 md:py-3 md:text-end"
                  >
                    {{ product.price | price }}
                  </td>
                  <td class="inline-block pe-3 md:table-cell md:px-4 md:py-3 md:text-center">
                    <span
                      class="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums"
                      [class]="stockClass(product.stockQuantity)"
                    >
                      {{ product.stockQuantity }}
                    </span>
                  </td>
                  <td class="inline-block md:table-cell md:px-4 md:py-3 md:text-center">
                    <span
                      class="inline-flex items-center gap-1.5 text-xs font-semibold"
                      [class]="product.isActive ? 'text-success' : 'text-muted'"
                    >
                      <span
                        class="size-2 rounded-full"
                        [class]="product.isActive ? 'bg-success' : 'bg-muted/50'"
                      ></span>
                      {{
                        (product.isActive
                          ? 'admin.products.filter.active'
                          : 'admin.products.hidden'
                        ) | transloco
                      }}
                    </span>
                  </td>
                  <td class="block pt-2 md:table-cell md:px-4 md:py-3 md:pt-3 md:text-end">
                    <div class="flex gap-2 md:justify-end">
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
                          <button
                            type="button"
                            class="btn !py-1.5"
                            (click)="hidingId.set(product.id)"
                          >
                            {{ 'admin.products.hide' | transloco }}
                          </button>
                        }
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

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

  protected readonly statusFilters = [
    { key: 'all', value: undefined },
    { key: 'active', value: 'true' },
    { key: 'hidden', value: 'false' },
  ];
  protected readonly stockFilters = ['low', 'out', 'ok'];
  protected readonly sorts = ['newest', 'name', 'price_asc', 'price_desc', 'stock_asc'];
  protected readonly hidingId = signal<number | null>(null);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  /** التصنيفات الفرعية بس (دي اللي المنتجات بتتحط فيها). */
  protected readonly categories = toSignal(
    inject(CatalogService).categories$.pipe(
      map((all) => all.filter((category) => category.parentId !== null)),
      catchError(() => of<Category[]>([])),
    ),
    { initialValue: [] as Category[] },
  );

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly params = computed(() => {
    const q = this.queryParams();
    return {
      search: q.get('search') ?? undefined,
      active: q.get('active') ?? undefined,
      categoryId: q.get('categoryId') ?? undefined,
      stock: q.get('stock') ?? undefined,
      sort: q.get('sort') ?? undefined,
      page: Number(q.get('page')) > 0 ? Number(q.get('page')) : 1,
    };
  });

  protected readonly hasFilters = computed(() => {
    const p = this.params();
    return !!(p.search || p.active || p.categoryId || p.stock || p.sort);
  });

  protected readonly state = toSignal(
    combineLatest([toObservable(this.params), this.reload$]).pipe(
      switchMap(([p]) =>
        this.admin
          .products({
            search: p.search,
            active: p.active === undefined ? undefined : p.active === 'true',
            categoryId: p.categoryId ? Number(p.categoryId) : undefined,
            stock: p.stock,
            sort: p.sort,
            page: p.page,
            pageSize: 20,
          })
          .pipe(toLoadState()),
      ),
    ),
    { initialValue: { status: 'loading' } as LoadState<PagedResult<AdminProductRow>> },
  );

  protected chip(active: boolean): string {
    return active
      ? 'border-accent bg-accent text-accent-fg'
      : 'border-border bg-surface hover:border-accent/50';
  }

  protected stockClass(quantity: number): string {
    if (quantity === 0) return 'bg-danger/15 text-danger';
    return quantity <= 3 ? 'bg-highlight/25 text-highlight-strong' : 'bg-surface-2';
  }

  protected set(changes: Record<string, string | null>): void {
    void this.router.navigate([], {
      queryParams: { ...changes, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected clear(): void {
    this.set({ search: null, active: null, categoryId: null, stock: null, sort: null });
  }

  protected search(event: Event, value: string): void {
    event.preventDefault();
    this.set({ search: value.trim() || null });
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
