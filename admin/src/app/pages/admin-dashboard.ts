import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { LoadState, toLoadState } from '@web/core/state/load-state';
import { DateTimePipe } from '@web/shared/pipes/date-time.pipe';
import { PricePipe } from '@web/shared/pipes/price.pipe';
import { Icon, IconName } from '@web/shared/ui/icon';
import { OrderStatusBadge } from '@web/shared/ui/order-status';
import { AdminOrderRow, AdminStats, ORDER_STATUSES } from '../data/admin.models';
import { AdminService } from '../data/admin.service';

/** الصفحة الأولى: أرقام اليوم، آخر الطلبات، حالة الطلبات، المنتجات اللي قربت تخلص، وآخر 7 أيام. */
@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, TranslocoPipe, PricePipe, DateTimePipe, Icon, OrderStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let current = state();
    @if (current.status === 'ready') {
      @let stats = current.data;

      @if (stats.ordersByStatus['Placed'] > 0) {
        <a
          routerLink="/orders"
          [queryParams]="{ status: 'Placed' }"
          class="mb-5 flex items-center gap-3 rounded-xl border border-highlight/60 bg-accent-soft px-4 py-3 text-sm transition hover:border-accent"
        >
          <app-icon name="bolt" [size]="1.2" class="text-accent" />
          <span class="flex-1 font-semibold">
            {{ 'admin.dashboard.newOrders' | transloco }}:
            <b class="tabular-nums">{{ stats.ordersByStatus['Placed'] }}</b>
          </span>
          <span class="font-semibold text-accent">{{ 'admin.dashboard.review' | transloco }}</span>
        </a>
      }

      <ul class="grid grid-cols-2 gap-4 xl:grid-cols-4">
        @for (card of cards(stats); track card.key) {
          <li class="card flex items-center gap-3 p-4">
            <span
              class="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"
            >
              <app-icon [name]="card.icon" [size]="1.3" />
            </span>
            <div class="min-w-0">
              <p class="truncate text-xs text-muted">
                {{ 'admin.dashboard.' + card.key | transloco }}
              </p>
              <p class="truncate text-xl font-bold tabular-nums">
                @if (card.money) {
                  {{ card.value | price }}
                } @else {
                  {{ card.value }}
                }
              </p>
            </div>
          </li>
        }
      </ul>

      <div class="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section class="card overflow-hidden" aria-labelledby="recent-title">
          <div class="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 id="recent-title" class="font-bold">
              {{ 'admin.dashboard.recent' | transloco }}
            </h2>
            <a routerLink="/orders" class="text-sm font-semibold text-accent hover:underline">
              {{ 'admin.dashboard.viewAll' | transloco }}
            </a>
          </div>
          @if (recent().length === 0) {
            <p class="px-5 py-8 text-center text-sm text-muted">
              {{ 'admin.orders.empty' | transloco }}
            </p>
          } @else {
            <ul class="divide-y divide-border">
              @for (order of recent(); track order.id) {
                <li>
                  <a
                    [routerLink]="['/orders', order.id]"
                    class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm transition hover:bg-accent-soft/50"
                  >
                    <span class="w-12 font-bold tabular-nums">#{{ order.id }}</span>
                    <span class="min-w-0 flex-1 truncate font-medium">{{
                      order.shippingName
                    }}</span>
                    <app-order-status [status]="order.status" />
                    <span class="hidden text-muted sm:block">{{ order.createdAt | dateTime }}</span>
                    <span class="w-28 text-end font-bold text-accent-hover">{{
                      order.total | price
                    }}</span>
                  </a>
                </li>
              }
            </ul>
          }
        </section>

        <section class="card p-5" aria-labelledby="status-title">
          <h2 id="status-title" class="mb-3 font-bold">
            {{ 'admin.dashboard.byStatus' | transloco }}
          </h2>
          <ul class="grid gap-1.5">
            @for (status of statuses; track status) {
              <li>
                <a
                  routerLink="/orders"
                  [queryParams]="{ status }"
                  class="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-accent-soft/60"
                >
                  <app-order-status [status]="status" />
                  <b class="tabular-nums">{{ stats.ordersByStatus[status] }}</b>
                </a>
              </li>
            }
          </ul>
        </section>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <section class="card p-5" aria-labelledby="week-title">
          <h2 id="week-title" class="mb-4 font-bold">
            {{ 'admin.dashboard.last7' | transloco }}
          </h2>
          <ul class="flex h-36 items-end gap-2" dir="ltr">
            @for (day of stats.last7Days; track day.date) {
              <li class="flex flex-1 flex-col items-center gap-1">
                <span class="text-xs tabular-nums text-muted">{{ day.orders }}</span>
                <span
                  class="w-full rounded-t-md bg-accent/80"
                  [style.height.px]="barHeight(day.orders, stats)"
                  [attr.aria-label]="day.date + ': ' + day.orders"
                ></span>
                <span class="text-[10px] text-muted">{{ day.date.slice(5) }}</span>
              </li>
            }
          </ul>
        </section>

        <section class="card p-5" aria-labelledby="low-title">
          <h2 id="low-title" class="mb-3 font-bold">
            {{ 'admin.dashboard.lowStock' | transloco }}
          </h2>
          @if (stats.lowStock.length === 0) {
            <p class="text-sm text-muted">{{ 'admin.dashboard.stockOk' | transloco }}</p>
          } @else {
            <ul class="divide-y divide-border">
              @for (item of stats.lowStock; track item.id) {
                <li>
                  <a
                    [routerLink]="['/products', item.id]"
                    class="flex items-center gap-3 py-2 transition hover:text-accent"
                  >
                    @if (item.imageUrl) {
                      <img [src]="item.imageUrl" alt="" class="size-10 rounded-lg object-cover" />
                    }
                    <span class="flex-1 text-sm font-medium">{{ item.name }}</span>
                    <span
                      class="rounded-full px-2.5 py-0.5 text-xs font-bold"
                      [class]="
                        item.stockQuantity === 0
                          ? 'bg-danger/15 text-danger'
                          : 'bg-highlight/25 text-highlight-strong'
                      "
                    >
                      {{ item.stockQuantity }}
                    </span>
                  </a>
                </li>
              }
            </ul>
          }
        </section>
      </div>
    } @else if (current.status === 'loading') {
      <div class="grid gap-4" aria-hidden="true">
        <div class="card skeleton h-20"></div>
        <div class="card skeleton h-64"></div>
      </div>
    } @else {
      <p class="card p-6 text-danger" role="alert">{{ 'admin.loadError' | transloco }}</p>
    }
  `,
})
export class AdminDashboard {
  private readonly admin = inject(AdminService);
  protected readonly statuses = ORDER_STATUSES;

  protected readonly state = toSignal(this.admin.stats().pipe(toLoadState()), {
    initialValue: { status: 'loading' } as LoadState<AdminStats>,
  });

  private readonly recentOrders = toSignal(
    this.admin.orders({ pageSize: 6 }).pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  protected recent(): AdminOrderRow[] {
    return this.recentOrders()?.items ?? [];
  }

  protected cards(stats: AdminStats): {
    key: string;
    value: number;
    money: boolean;
    icon: IconName;
  }[] {
    return [
      { key: 'today', value: stats.ordersToday, money: false, icon: 'clock' },
      { key: 'openValue', value: stats.openOrdersValue, money: true, icon: 'cart' },
      { key: 'delivered', value: stats.deliveredRevenue, money: true, icon: 'cash' },
      { key: 'unread', value: stats.unreadMessages, money: false, icon: 'mail' },
    ];
  }

  protected barHeight(orders: number, stats: AdminStats): number {
    const max = Math.max(1, ...stats.last7Days.map((d) => d.orders));
    return Math.max(4, (orders / max) * 80);
  }
}
