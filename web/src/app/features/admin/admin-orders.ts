import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { switchMap } from 'rxjs';
import { AdminOrderRow, ORDER_STATUSES } from '../../core/admin/admin.models';
import { AdminService } from '../../core/admin/admin.service';
import { PagedResult } from '../../core/models/api.models';
import { LoadState, toLoadState } from '../../core/state/load-state';
import { DateTimePipe } from '../../shared/pipes/date-time.pipe';
import { PricePipe } from '../../shared/pipes/price.pipe';
import { OrderStatusBadge } from '../../shared/ui/order-status';

/** كل الطلبات، بفلتر الحالة وبحث بالاسم أو التليفون أو رقم الطلب. الفلتر كله في الـ URL. */
@Component({
  selector: 'app-admin-orders',
  imports: [RouterLink, TranslocoPipe, PricePipe, DateTimePipe, OrderStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap gap-2">
      <a
        routerLink="/admin/orders"
        [queryParams]="{ search: params().search }"
        class="rounded-full border px-3.5 py-1.5 text-sm transition"
        [class]="
          !params().status ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface'
        "
      >
        {{ 'admin.all' | transloco }}
      </a>
      @for (status of statuses; track status) {
        <a
          routerLink="/admin/orders"
          [queryParams]="{ status, search: params().search }"
          class="rounded-full border px-3.5 py-1.5 text-sm transition"
          [class]="
            params().status === status
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-border bg-surface'
          "
        >
          {{ 'orders.status.' + status | transloco }}
        </a>
      }
    </div>

    <form class="mb-5 flex gap-2" (submit)="search($event, q.value)">
      <input
        #q
        type="search"
        class="field"
        [value]="params().search ?? ''"
        [placeholder]="'admin.orders.searchPlaceholder' | transloco"
        [attr.aria-label]="'admin.orders.searchPlaceholder' | transloco"
      />
      <button type="submit" class="btn btn-accent">{{ 'admin.search' | transloco }}</button>
    </form>

    @let current = state();
    @if (current.status === 'ready') {
      @if (current.data.items.length === 0) {
        <p class="card p-8 text-center text-muted">{{ 'admin.orders.empty' | transloco }}</p>
      } @else {
        <ul class="grid gap-3">
          @for (order of current.data.items; track order.id) {
            <li>
              <a
                [routerLink]="['/admin/orders', order.id]"
                class="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift"
              >
                <span class="text-lg font-bold tabular-nums">#{{ order.id }}</span>
                <app-order-status [status]="order.status" />
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold">{{ order.shippingName }}</span>
                  <span class="block text-sm text-muted" dir="ltr"
                    >{{ order.phone }} · {{ order.city }}</span
                  >
                </span>
                <span class="text-sm text-muted">{{ order.createdAt | dateTime }}</span>
                <span class="font-bold text-accent-hover">{{ order.total | price }}</span>
              </a>
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
        <div class="card skeleton h-20"></div>
      </div>
    } @else {
      <p class="card p-6 text-danger" role="alert">{{ 'admin.loadError' | transloco }}</p>
    }
  `,
})
export class AdminOrders {
  private readonly admin = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly statuses = ORDER_STATUSES;

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly params = computed(() => {
    const q = this.queryParams();
    return {
      status: q.get('status') ?? undefined,
      search: q.get('search') ?? undefined,
      page: Number(q.get('page')) > 0 ? Number(q.get('page')) : 1,
    };
  });

  protected readonly state = toSignal(
    toObservable(this.params).pipe(
      switchMap((p) => this.admin.orders({ ...p, pageSize: 20 }).pipe(toLoadState())),
    ),
    { initialValue: { status: 'loading' } as LoadState<PagedResult<AdminOrderRow>> },
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
}
