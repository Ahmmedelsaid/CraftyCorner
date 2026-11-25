import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map, switchMap, tap } from 'rxjs';
import { initialOf } from '@shared/core/forms/form-errors';
import { Order, OrderStatus } from '@shared/core/orders/order.models';
import { LoadState, toLoadState } from '@shared/core/state/load-state';
import { ToastService } from '@shared/core/toast/toast.service';
import { DateTimePipe } from '@shared/pipes/date-time.pipe';
import { PricePipe } from '@shared/pipes/price.pipe';
import { Icon } from '@shared/ui/icon';
import { OrderStatusBadge } from '@shared/ui/order-status';
import { NEXT_STATUSES, toWhatsAppNumber } from '../data/admin.models';
import { AdminService } from '../data/admin.service';

/** طلب واحد: الحالة والخطوة اللي بعدها، المنتجات، وبيانات العميل مع أزرار التواصل. */
@Component({
  selector: 'app-admin-order-detail',
  imports: [RouterLink, TranslocoPipe, PricePipe, DateTimePipe, OrderStatusBadge, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/orders"
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
    >
      <app-icon name="chevron-left" [size]="1" class="rtl:rotate-180" />
      {{ 'admin.orders.back' | transloco }}
    </a>

    @let loaded = state();
    @if (order(); as order) {
      <section class="card mb-5 p-5">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 class="text-3xl font-bold tabular-nums">#{{ order.id }}</h2>
          <app-order-status [status]="order.status" />
          <span class="text-sm text-muted">{{ order.createdAt | dateTime }}</span>

          @if (nextStatuses().length) {
            <div class="ms-auto flex flex-wrap gap-2">
              @for (next of nextStatuses(); track next) {
                @if (next === 'Cancelled') {
                  <button
                    type="button"
                    class="btn !border-danger !text-danger"
                    [disabled]="busy()"
                    (click)="confirmingCancel.set(true)"
                  >
                    {{ 'admin.order.action.Cancelled' | transloco }}
                  </button>
                } @else {
                  <button
                    type="button"
                    class="btn btn-accent px-5"
                    [disabled]="busy()"
                    (click)="change(order, next)"
                  >
                    {{ 'admin.order.action.' + next | transloco }}
                  </button>
                }
              }
            </div>
          }
        </div>

        @if (order.status !== 'Cancelled') {
          <ol
            class="mt-6 grid grid-cols-5 gap-1"
            [attr.aria-label]="'admin.orders.col.status' | transloco"
          >
            @for (step of trackSteps; track step; let i = $index) {
              <li class="relative flex flex-col items-center gap-2 text-center">
                @if (i > 0) {
                  <span
                    class="absolute start-1/2 top-3.5 -z-0 h-0.5 w-full -translate-x-full rtl:translate-x-full"
                    [class]="i <= stepIndex(order.status) ? 'bg-accent' : 'bg-border'"
                    aria-hidden="true"
                  ></span>
                }
                <span
                  class="relative z-10 grid size-7 place-items-center rounded-full text-xs font-bold"
                  [class]="
                    i <= stepIndex(order.status)
                      ? 'bg-accent text-accent-fg'
                      : 'border border-border bg-surface text-muted'
                  "
                  [attr.aria-current]="i === stepIndex(order.status) ? 'step' : null"
                >
                  @if (i < stepIndex(order.status)) {
                    <app-icon name="check" [size]="0.85" />
                  } @else {
                    {{ i + 1 }}
                  }
                </span>
                <span
                  class="text-[11px] leading-tight sm:text-xs"
                  [class]="i === stepIndex(order.status) ? 'font-bold' : 'text-muted'"
                >
                  {{ 'orders.status.' + step | transloco }}
                </span>
              </li>
            }
          </ol>
        }

        @if (confirmingCancel()) {
          <div
            class="mt-5 grid gap-2 rounded-2xl border border-danger/40 bg-danger/5 p-4"
            role="alertdialog"
          >
            <p class="text-sm">{{ 'admin.order.cancelConfirm' | transloco }}</p>
            <div class="flex gap-2">
              <button
                type="button"
                class="btn flex-1 !border-danger !text-danger"
                [disabled]="busy()"
                (click)="change(order, 'Cancelled')"
              >
                {{ 'admin.order.cancelYes' | transloco }}
              </button>
              <button type="button" class="btn flex-1" (click)="confirmingCancel.set(false)">
                {{ 'admin.order.cancelNo' | transloco }}
              </button>
            </div>
          </div>
        }
      </section>

      <div class="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section class="card overflow-hidden">
          <h3 class="border-b border-border px-5 py-3.5 font-bold">
            {{ 'admin.order.items' | transloco }}
            <span class="ms-1 text-sm font-normal text-muted">({{ order.itemCount }})</span>
          </h3>
          <ul class="divide-y divide-border">
            @for (item of order.items; track item.productId) {
              <li class="flex items-center gap-4 px-5 py-3">
                <div class="arch size-14 shrink-0 !rounded-[999px_999px_0.6rem_0.6rem]">
                  @if (item.imageUrl) {
                    <img [src]="item.imageUrl" alt="" />
                  }
                </div>
                <div class="min-w-0 flex-1">
                  <a
                    [routerLink]="['/products', item.productId]"
                    class="block font-semibold hover:text-accent"
                    >{{ item.name }}</a
                  >
                  <p class="text-sm text-muted">
                    {{ item.unitPrice | price }} × {{ item.quantity }}
                  </p>
                </div>
                <p class="font-bold tabular-nums">{{ item.lineTotal | price }}</p>
              </li>
            }
          </ul>
          <div class="grid gap-1 border-t border-border bg-surface-2/50 px-5 py-4">
            <p class="flex justify-between text-lg font-bold">
              <span>{{ 'orders.total' | transloco }}</span>
              <span class="text-accent-hover">{{ order.total | price }}</span>
            </p>
            <p class="flex items-center gap-1.5 text-sm text-muted">
              <app-icon name="cash" [size]="1" />
              {{ 'checkout.cod' | transloco }}
            </p>
          </div>
        </section>

        <div class="grid content-start gap-5">
          @if (order.status !== 'Cancelled') {
            <section class="card grid content-start gap-3 p-5">
              <h2 class="flex items-center gap-2 font-bold">
                <app-icon name="truck" [size]="1.1" class="text-accent" />
                {{ 'admin.tracking.title' | transloco }}
              </h2>
              <p class="text-xs text-muted">{{ 'admin.tracking.hint' | transloco }}</p>
              <label class="grid gap-1 text-sm font-medium">
                {{ 'admin.tracking.company' | transloco }}
                <input
                  #company
                  class="field"
                  maxlength="60"
                  [value]="order.trackingCompany ?? ''"
                  [placeholder]="'admin.tracking.companyPlaceholder' | transloco"
                />
              </label>
              <label class="grid gap-1 text-sm font-medium">
                {{ 'admin.tracking.number' | transloco }}
                <input
                  #number
                  class="field"
                  dir="ltr"
                  maxlength="60"
                  [value]="order.trackingNumber ?? ''"
                />
              </label>
              <button
                type="button"
                class="btn btn-accent"
                [disabled]="busy()"
                (click)="saveTracking(order, company.value, number.value)"
              >
                {{ 'admin.save' | transloco }}
              </button>
              @if (order.trackingNumber) {
                <a class="btn" [href]="whatsAppUrl(order)" target="_blank" rel="noopener">
                  <app-icon name="chat" [size]="1" />
                  {{ 'admin.tracking.sendWhatsapp' | transloco }}
                </a>
              }
            </section>
          }

          <section class="card grid content-start gap-4 p-5">
            <div class="flex items-center gap-3">
              <span
                class="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-lg font-bold text-accent-fg"
                aria-hidden="true"
                >{{ initial(order.shippingName) }}</span
              >
              <div class="min-w-0">
                <p class="text-xs text-muted">{{ 'admin.order.customer' | transloco }}</p>
                <p class="truncate font-bold">{{ order.shippingName }}</p>
              </div>
            </div>

            <p
              dir="ltr"
              class="rounded-lg bg-surface-2/60 px-3 py-2 text-center font-semibold tabular-nums"
            >
              {{ order.phone }}
            </p>
            <div class="grid grid-cols-2 gap-2">
              <a class="btn" [href]="'tel:' + order.phone">
                <app-icon name="phone" [size]="1" />
                {{ 'admin.order.call' | transloco }}
              </a>
              <a class="btn" [href]="whatsAppUrl(order)" target="_blank" rel="noopener">
                <app-icon name="chat" [size]="1" />
                {{ 'admin.order.whatsapp' | transloco }}
              </a>
            </div>

            <div class="border-t border-border pt-4">
              <p class="mb-1 flex items-center gap-1.5 text-xs text-muted">
                <app-icon name="pin" [size]="0.9" />
                {{ 'admin.order.address' | transloco }}
              </p>
              <p>{{ order.address }}</p>
              <p class="text-muted">{{ order.city }}</p>
              @if (order.latitude !== null && order.longitude !== null) {
                <a
                  class="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
                  target="_blank"
                  rel="noopener"
                  [href]="mapUrl(order)"
                >
                  {{ 'orders.viewOnMap' | transloco }}
                </a>
              }
            </div>

            @if (order.notes) {
              <div class="border-t border-border pt-4">
                <p class="mb-1 text-xs text-muted">{{ 'admin.order.notes' | transloco }}</p>
                <p class="rounded-lg bg-accent-soft/60 px-3 py-2 text-sm">{{ order.notes }}</p>
              </div>
            }
          </section>
        </div>
      </div>
    } @else if (loaded.status === 'loading') {
      <div class="card skeleton h-48" aria-hidden="true"></div>
    } @else {
      <p class="card p-6 text-danger" role="alert">{{ 'admin.loadError' | transloco }}</p>
    }
  `,
})
export class AdminOrderDetail {
  private readonly admin = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly initial = initialOf;
  protected readonly trackSteps = ['Placed', 'Confirmed', 'Preparing', 'Shipped', 'Delivered'];

  /** الطلب بعد آخر تغيير حالة (بيغطي على اللي اتحمّل أول مرة). */
  private readonly updated = signal<Order | null>(null);
  protected readonly busy = signal(false);
  protected readonly confirmingCancel = signal(false);

  protected readonly state = toSignal(
    this.route.paramMap.pipe(
      map((params) => Number(params.get('id'))),
      tap(() => this.updated.set(null)),
      switchMap((id) => this.admin.order(id).pipe(toLoadState())),
    ),
    { initialValue: { status: 'loading' } as LoadState<Order> },
  );

  protected readonly order = computed(() => {
    const loaded = this.state();
    return this.updated() ?? (loaded.status === 'ready' ? loaded.data : null);
  });

  protected readonly nextStatuses = computed(() => {
    const order = this.order();
    return order ? NEXT_STATUSES[order.status] : [];
  });

  protected stepIndex(status: string): number {
    return this.trackSteps.indexOf(status);
  }

  protected change(order: Order, status: OrderStatus): void {
    this.busy.set(true);
    this.admin.setOrderStatus(order.id, status).subscribe({
      next: (next) => {
        this.updated.set(next);
        this.confirmingCancel.set(false);
        this.busy.set(false);
        this.toasts.show({ kind: 'success', key: 'admin.order.updated' });
      },
      error: () => {
        this.busy.set(false);
        this.confirmingCancel.set(false);
        this.toasts.show({ kind: 'error', key: 'admin.order.updateFailed' });
      },
    });
  }

  /** رسالة جاهزة للعميل على واتساب (للتواصل بس: الطلب نفسه بيتم من الموقع). */
  protected whatsAppUrl(order: Order): string {
    const shipped = order.status === 'Shipped' || !!order.trackingNumber;
    const text = this.transloco.translate(
      shipped ? 'admin.order.waShipped' : 'admin.order.waMessage',
      {
        name: order.shippingName,
        id: order.id,
        company: order.trackingCompany || '-',
        number: order.trackingNumber || '-',
      },
    );
    return `https://wa.me/${toWhatsAppNumber(order.phone)}?text=${encodeURIComponent(text)}`;
  }

  protected saveTracking(order: Order, company: string, number: string): void {
    this.busy.set(true);
    this.admin
      .setTracking(order.id, { company: company.trim() || null, number: number.trim() || null })
      .subscribe({
        next: (next) => {
          this.updated.set(next);
          this.busy.set(false);
          this.toasts.show({ kind: 'success', key: 'admin.saved' });
        },
        error: () => {
          this.busy.set(false);
          this.toasts.show({ kind: 'error', key: 'admin.saveFailed' });
        },
      });
  }

  protected mapUrl(order: Order): string {
    return `https://www.openstreetmap.org/?mlat=${order.latitude}&mlon=${order.longitude}#map=17/${order.latitude}/${order.longitude}`;
  }
}
