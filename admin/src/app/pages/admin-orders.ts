import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { switchMap } from 'rxjs';
import { PagedResult } from '@shared/core/models/api.models';
import { LoadState, toLoadState } from '@shared/core/state/load-state';
import { DateTimePipe } from '@shared/pipes/date-time.pipe';
import { PricePipe } from '@shared/pipes/price.pipe';
import { Icon } from '@shared/ui/icon';
import { OrderStatusBadge } from '@shared/ui/order-status';
import { AdminOrderRow, ORDER_STATUSES } from '../data/admin.models';
import { AdminService } from '../data/admin.service';

/** yyyy-MM-dd بتوقيت المتصفح (مش UTC، عشان "النهاردة" تبقى نهاردة عند المستخدم). */
function localDate(offsetDays = 0, firstOfMonth = false): string {
  const d = new Date();
  if (firstOfMonth) d.setDate(1);
  else d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** كل الطلبات: فلتر بالحالة والتاريخ وبحث بالاسم أو التليفون أو رقم الطلب. الفلتر كله في الـ URL. */
@Component({
  selector: 'app-admin-orders',
  imports: [RouterLink, TranslocoPipe, PricePipe, DateTimePipe, OrderStatusBadge, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
            [placeholder]="'admin.orders.searchPlaceholder' | transloco"
            [attr.aria-label]="'admin.orders.searchPlaceholder' | transloco"
          />
        </div>
        <button type="submit" class="btn btn-accent">{{ 'admin.search' | transloco }}</button>
      </form>

      <div
        class="flex flex-wrap gap-2"
        role="group"
        [attr.aria-label]="'admin.orders.status' | transloco"
      >
        <button
          type="button"
          class="rounded-full border px-3.5 py-1.5 text-sm transition"
          [class]="chip(!params().status)"
          (click)="set({ status: null })"
        >
          {{ 'admin.all' | transloco }}
        </button>
        @for (status of statuses; track status) {
          <button
            type="button"
            class="rounded-full border px-3.5 py-1.5 text-sm transition"
            [class]="chip(params().status === status)"
            (click)="set({ status })"
          >
            {{ 'orders.status.' + status | transloco }}
          </button>
        }
      </div>

      <div class="flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-border pt-4">
        <label class="grid gap-1 text-xs font-medium text-muted">
          {{ 'admin.orders.dateFrom' | transloco }}
          <input
            type="date"
            class="field !w-auto"
            [value]="params().from ?? ''"
            [max]="params().to ?? ''"
            (change)="set({ from: $any($event.target).value || null })"
          />
        </label>
        <label class="grid gap-1 text-xs font-medium text-muted">
          {{ 'admin.orders.dateTo' | transloco }}
          <input
            type="date"
            class="field !w-auto"
            [value]="params().to ?? ''"
            [min]="params().from ?? ''"
            (change)="set({ to: $any($event.target).value || null })"
          />
        </label>
        <div class="flex flex-wrap gap-2">
          @for (preset of presets; track preset.key) {
            <button
              type="button"
              class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
              [class]="chip(isPreset(preset))"
              (click)="set({ from: preset.from(), to: preset.to() })"
            >
              {{ 'admin.orders.preset.' + preset.key | transloco }}
            </button>
          }
        </div>
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
      <p class="mb-2 text-sm text-muted">
        {{ 'admin.orders.results' | transloco: { count: current.data.totalCount } }}
      </p>

      @if (current.data.items.length === 0) {
        <p class="card p-10 text-center text-muted">{{ 'admin.orders.empty' | transloco }}</p>
      } @else {
        <div class="card overflow-hidden">
          <table class="w-full text-sm">
            <thead
              class="hidden border-b border-border bg-surface-2/60 text-start text-xs text-muted md:table-header-group"
            >
              <tr>
                <th class="px-4 py-3 text-start font-semibold">
                  {{ 'admin.orders.col.id' | transloco }}
                </th>
                <th class="px-4 py-3 text-start font-semibold">
                  {{ 'admin.orders.col.customer' | transloco }}
                </th>
                <th class="px-4 py-3 text-start font-semibold">
                  {{ 'admin.orders.col.date' | transloco }}
                </th>
                <th class="px-4 py-3 text-start font-semibold">
                  {{ 'admin.orders.col.status' | transloco }}
                </th>
                <th class="px-4 py-3 text-end font-semibold">
                  {{ 'admin.orders.col.items' | transloco }}
                </th>
                <th class="px-4 py-3 text-end font-semibold">
                  {{ 'admin.orders.col.total' | transloco }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              @for (order of current.data.items; track order.id) {
                <tr
                  class="block cursor-pointer px-4 py-3 transition hover:bg-accent-soft/50 md:table-row md:px-0 md:py-0"
                  (click)="open(order.id)"
                >
                  <td
                    class="inline-block pe-3 font-bold tabular-nums md:table-cell md:px-4 md:py-3"
                  >
                    <a
                      [routerLink]="['/orders', order.id]"
                      class="hover:text-accent"
                      (click)="$event.stopPropagation()"
                      >#{{ order.id }}</a
                    >
                  </td>
                  <td class="block md:table-cell md:px-4 md:py-3">
                    <span class="block font-semibold">{{ order.shippingName }}</span>
                    <span class="block text-xs text-muted" dir="ltr"
                      >{{ order.phone }} · {{ order.city }}</span
                    >
                  </td>
                  <td class="inline-block pe-3 text-muted md:table-cell md:px-4 md:py-3">
                    {{ order.createdAt | dateTime }}
                  </td>
                  <td class="inline-block md:table-cell md:px-4 md:py-3">
                    <app-order-status [status]="order.status" />
                  </td>
                  <td class="hidden px-4 py-3 text-end tabular-nums md:table-cell">
                    {{ order.itemCount }}
                  </td>
                  <td
                    class="block pt-1 font-bold text-accent-hover md:table-cell md:px-4 md:py-3 md:pt-3 md:text-end"
                  >
                    {{ order.total | price }}
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
        <div class="card skeleton h-16"></div>
        <div class="card skeleton h-16"></div>
        <div class="card skeleton h-16"></div>
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

  protected readonly presets = [
    { key: 'today', from: () => localDate(0), to: () => localDate(0) },
    { key: 'days7', from: () => localDate(-6), to: () => localDate(0) },
    { key: 'days30', from: () => localDate(-29), to: () => localDate(0) },
    { key: 'month', from: () => localDate(0, true), to: () => localDate(0) },
  ];

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly params = computed(() => {
    const q = this.queryParams();
    return {
      status: q.get('status') ?? undefined,
      search: q.get('search') ?? undefined,
      from: q.get('from') ?? undefined,
      to: q.get('to') ?? undefined,
      page: Number(q.get('page')) > 0 ? Number(q.get('page')) : 1,
    };
  });

  protected readonly hasFilters = computed(() => {
    const p = this.params();
    return !!(p.status || p.search || p.from || p.to);
  });

  protected readonly state = toSignal(
    toObservable(this.params).pipe(
      switchMap((p) => this.admin.orders({ ...p, pageSize: 20 }).pipe(toLoadState())),
    ),
    { initialValue: { status: 'loading' } as LoadState<PagedResult<AdminOrderRow>> },
  );

  protected chip(active: boolean): string {
    return active
      ? 'border-accent bg-accent text-accent-fg'
      : 'border-border bg-surface hover:border-accent/50';
  }

  protected isPreset(preset: { from: () => string; to: () => string }): boolean {
    const p = this.params();
    return p.from === preset.from() && p.to === preset.to();
  }

  protected set(changes: Record<string, string | null>): void {
    void this.router.navigate([], {
      queryParams: { ...changes, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected clear(): void {
    this.set({ status: null, search: null, from: null, to: null });
  }

  protected search(event: Event, value: string): void {
    event.preventDefault();
    this.set({ search: value.trim() || null });
  }

  protected open(id: number): void {
    void this.router.navigate(['/orders', id]);
  }

  protected go(page: number): void {
    void this.router.navigate([], { queryParams: { page }, queryParamsHandling: 'merge' });
  }
}
