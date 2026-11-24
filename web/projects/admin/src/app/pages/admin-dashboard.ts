import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AdminService } from '../data/admin.service';
import { AdminStats, ORDER_STATUSES } from '../data/admin.models';
import { LoadState, toLoadState } from '@web/core/state/load-state';
import { PricePipe } from '@web/shared/pipes/price.pipe';

/** الصفحة الأولى: أرقام اليوم، حالة الطلبات، المنتجات اللي قربت تخلص، وآخر 7 أيام. */
@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, TranslocoPipe, PricePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let current = state();
    @if (current.status === 'ready') {
      @let stats = current.data;

      <a
        routerLink="/orders"
        [queryParams]="{ status: 'Placed' }"
        class="card mb-4 flex items-center justify-between gap-3 border-highlight/60 bg-accent-soft p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div>
          <p class="text-sm text-muted">{{ 'admin.dashboard.newOrders' | transloco }}</p>
          <p class="text-4xl font-bold tabular-nums text-accent-hover">
            {{ stats.ordersByStatus['Placed'] }}
          </p>
        </div>
        <span class="text-sm font-semibold text-accent">{{
          'admin.dashboard.review' | transloco
        }}</span>
      </a>

      <ul class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        @for (card of cards(stats); track card.key) {
          <li class="card p-4">
            <p class="text-xs text-muted">{{ 'admin.dashboard.' + card.key | transloco }}</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">
              @if (card.money) {
                {{ card.value | price }}
              } @else {
                {{ card.value }}
              }
            </p>
          </li>
        }
      </ul>

      <section class="mt-8" aria-labelledby="status-title">
        <h2 id="status-title" class="mb-3 text-lg font-bold">
          {{ 'admin.dashboard.byStatus' | transloco }}
        </h2>
        <ul class="flex flex-wrap gap-2">
          @for (status of statuses; track status) {
            <li>
              <a
                routerLink="/orders"
                [queryParams]="{ status }"
                class="flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:border-accent/50"
              >
                {{ 'orders.status.' + status | transloco }}
                <b class="rounded-full bg-surface-2 px-2 tabular-nums">{{
                  stats.ordersByStatus[status]
                }}</b>
              </a>
            </li>
          }
        </ul>
      </section>

      <div class="mt-8 grid gap-6 lg:grid-cols-2">
        <section class="card p-5" aria-labelledby="week-title">
          <h2 id="week-title" class="mb-4 text-lg font-bold">
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
          <h2 id="low-title" class="mb-3 text-lg font-bold">
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
      <div class="grid gap-3" aria-hidden="true">
        <div class="card skeleton h-24"></div>
        <div class="card skeleton h-24"></div>
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

  protected cards(stats: AdminStats) {
    return [
      { key: 'today', value: stats.ordersToday, money: false },
      { key: 'openValue', value: stats.openOrdersValue, money: true },
      { key: 'delivered', value: stats.deliveredRevenue, money: true },
      { key: 'products', value: stats.activeProducts, money: false },
      { key: 'unread', value: stats.unreadMessages, money: false },
    ];
  }

  protected barHeight(orders: number, stats: AdminStats): number {
    const max = Math.max(1, ...stats.last7Days.map((d) => d.orders));
    return Math.max(4, (orders / max) * 80);
  }
}
