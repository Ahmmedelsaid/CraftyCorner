import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { switchMap } from 'rxjs';
import { OrderStatus, OrderSummary } from '@shared/core/orders/order.models';
import { OrdersService, orderErrorKey } from '../../core/orders/orders.service';
import { LoadState, toLoadState } from '@shared/core/state/load-state';
import { DateTimePipe } from '@shared/pipes/date-time.pipe';
import { PricePipe } from '@shared/pipes/price.pipe';
import { Icon } from '@shared/ui/icon';
import { OrderStatusBadge } from '@shared/ui/order-status';

type Group = 'all' | 'active' | 'delivered' | 'cancelled';

/** The steps an order goes through (a cancelled order has none). */
const STEPS: OrderStatus[] = ['Placed', 'Confirmed', 'Preparing', 'Shipped', 'Delivered'];

/** سجل طلبات العميل (الأحدث أولًا)، مع فلتر بسيط حسب الحالة. */
@Component({
  selector: 'app-orders',
  imports: [RouterLink, TranslocoPipe, PricePipe, DateTimePipe, Icon, OrderStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-8">
      <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">{{ 'orders.title' | transloco }}</h1>
          <p class="mt-1 text-sm text-muted">{{ 'orders.listSubtitle' | transloco }}</p>
        </div>
        <a routerLink="/products" class="btn">{{ 'orders.continue' | transloco }}</a>
      </header>

      @let current = state();
      @if (current.status === 'ready') {
        @if (current.data.length === 0) {
          <div
            class="grid place-items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center"
          >
            <app-icon name="box" [size]="2.5" class="text-muted/60" />
            <p class="text-muted">{{ 'account.noOrders' | transloco }}</p>
            <a routerLink="/products" class="btn btn-accent">{{
              'account.startShopping' | transloco
            }}</a>
          </div>
        } @else {
          <div class="mb-5 flex flex-wrap items-center gap-2" role="group">
            @for (group of groups; track group) {
              <button
                type="button"
                class="chip"
                [class.chip-active]="filter() === group"
                [attr.aria-pressed]="filter() === group"
                (click)="filter.set(group)"
              >
                {{ 'orders.filter.' + group | transloco }}
                <span
                  class="rounded-full bg-black/10 px-1.5 text-xs font-bold tabular-nums"
                  [class.bg-white/25]="filter() === group"
                >
                  {{ counts()[group] }}
                </span>
              </button>
            }
          </div>

          @if (shown().length === 0) {
            <p
              class="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted"
            >
              {{ 'orders.noMatch' | transloco }}
            </p>
          } @else {
            <ul class="grid gap-3 lg:grid-cols-2">
              @for (order of shown(); track order.id) {
                <li>
                  <a
                    [routerLink]="['/orders', order.id]"
                    class="group grid h-full gap-4 rounded-2xl border border-border bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-card sm:p-5"
                  >
                    <div class="flex items-start gap-4">
                      <!-- up to three photos, and how many more items there are -->
                      <div class="flex shrink-0 -space-x-3 rtl:space-x-reverse" aria-hidden="true">
                        @for (url of order.imageUrls; track $index) {
                          <span
                            class="relative size-16 shrink-0 overflow-hidden rounded-xl border-2 border-surface bg-photo"
                          >
                            <img
                              [src]="url"
                              alt=""
                              class="absolute inset-0 size-full object-contain p-1 mix-blend-multiply"
                            />
                          </span>
                        } @empty {
                          <span class="grid size-16 place-items-center rounded-xl bg-surface-2">
                            <app-icon name="box" [size]="1.5" class="text-muted/50" />
                          </span>
                        }
                        @if (order.itemCount > order.imageUrls.length && order.imageUrls.length) {
                          <span
                            class="relative grid size-16 shrink-0 place-items-center rounded-xl border-2 border-surface bg-surface-2 text-sm font-bold text-muted"
                          >
                            {{
                              'orders.moreItems'
                                | transloco: { count: order.itemCount - order.imageUrls.length }
                            }}
                          </span>
                        }
                      </div>

                      <div class="min-w-0 flex-1">
                        <p class="flex flex-wrap items-center gap-2 font-bold">
                          {{ 'orders.number' | transloco: { id: order.id } }}
                          <app-order-status [status]="order.status" />
                        </p>
                        <p class="mt-1 text-sm text-muted">{{ order.createdAt | dateTime }}</p>
                        <p class="text-xs text-muted">
                          {{ 'cart.items' | transloco: { count: order.itemCount } }}
                        </p>
                      </div>

                      <p class="shrink-0 text-lg font-bold">{{ order.total | price }}</p>
                    </div>

                    <div class="flex items-center gap-3 border-t border-border pt-3">
                      @if (order.status !== 'Cancelled') {
                        <!-- where the order is, at a glance -->
                        <span
                          class="flex flex-1 gap-1"
                          role="img"
                          [attr.aria-label]="'orders.status.' + order.status | transloco"
                        >
                          @for (step of steps; track step; let i = $index) {
                            <span
                              class="h-1.5 flex-1 rounded-full transition-colors"
                              [class]="i <= stepIndex(order.status) ? 'bg-accent' : 'bg-border'"
                            ></span>
                          }
                        </span>
                      } @else {
                        <span class="flex-1"></span>
                      }
                      <span
                        class="flex items-center gap-1 text-sm font-semibold text-accent group-hover:underline"
                      >
                        {{ 'orders.viewDetails' | transloco }}
                        <app-icon name="chevron-right" [size]="1" class="rtl:rotate-180" />
                      </span>
                    </div>
                  </a>
                </li>
              }
            </ul>
          }
        }
      } @else if (current.status === 'error') {
        <div
          role="alert"
          class="grid place-items-center gap-3 rounded-2xl border border-danger/40 bg-danger/5 px-6 py-14 text-center"
        >
          <h2 class="text-lg font-semibold">{{ 'errors.title' | transloco }}</h2>
          <p class="text-muted">{{ errorKey(current.error) | transloco }}</p>
          <button type="button" class="btn btn-accent" (click)="reload.set(reload() + 1)">
            {{ 'errors.retry' | transloco }}
          </button>
        </div>
      } @else {
        <div class="grid gap-3 lg:grid-cols-2" aria-hidden="true">
          @for (placeholder of skeletons; track placeholder) {
            <div class="h-36 skeleton rounded-2xl border border-border"></div>
          }
        </div>
      }
    </div>
  `,
})
export class Orders {
  private readonly orders = inject(OrdersService);

  protected readonly skeletons = [0, 1, 2, 3];
  protected readonly steps = STEPS;
  protected readonly groups: Group[] = ['all', 'active', 'delivered', 'cancelled'];
  protected readonly reload = signal(0);
  protected readonly filter = signal<Group>('all');
  protected readonly errorKey = orderErrorKey;

  protected readonly state = toSignal(
    toObservable(this.reload).pipe(switchMap(() => this.orders.list().pipe(toLoadState()))),
    { initialValue: { status: 'loading' } as LoadState<OrderSummary[]> },
  );

  private readonly all = computed(() => {
    const current = this.state();
    return current.status === 'ready' ? current.data : [];
  });

  private static group(status: OrderStatus): Group {
    if (status === 'Delivered') return 'delivered';
    if (status === 'Cancelled') return 'cancelled';
    return 'active';
  }

  protected readonly counts = computed(() => {
    const result: Record<Group, number> = { all: 0, active: 0, delivered: 0, cancelled: 0 };
    for (const order of this.all()) {
      result.all++;
      result[Orders.group(order.status)]++;
    }
    return result;
  });

  protected readonly shown = computed(() =>
    this.filter() === 'all'
      ? this.all()
      : this.all().filter((order) => Orders.group(order.status) === this.filter()),
  );

  protected stepIndex(status: OrderStatus): number {
    return STEPS.indexOf(status);
  }
}
