import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map, switchMap, tap } from 'rxjs';
import { NEXT_STATUSES, toWhatsAppNumber } from '../../core/admin/admin.models';
import { AdminService } from '../../core/admin/admin.service';
import { Order, OrderStatus } from '../../core/orders/order.models';
import { LoadState, toLoadState } from '../../core/state/load-state';
import { ToastService } from '../../core/toast/toast.service';
import { DateTimePipe } from '../../shared/pipes/date-time.pipe';
import { PricePipe } from '../../shared/pipes/price.pipe';
import { OrderStatusBadge } from '../../shared/ui/order-status';

/** طلب واحد: بيانات العميل، المنتجات، وأزرار نقل الطلب للخطوة اللي بعدها. */
@Component({
  selector: 'app-admin-order-detail',
  imports: [RouterLink, TranslocoPipe, PricePipe, DateTimePipe, OrderStatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/admin/orders" class="mb-4 inline-block text-sm font-semibold text-accent">
      ← {{ 'admin.orders.back' | transloco }}
    </a>

    @let loaded = state();
    @if (order(); as order) {
      <div class="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div class="grid content-start gap-5">
          <section class="card p-5">
            <div class="flex flex-wrap items-center gap-3">
              <h2 class="text-2xl font-bold tabular-nums">#{{ order.id }}</h2>
              <app-order-status [status]="order.status" />
              <span class="text-sm text-muted">{{ order.createdAt | dateTime }}</span>
            </div>

            @if (nextStatuses().length) {
              <div class="mt-4 flex flex-wrap gap-2">
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
                      class="btn btn-accent"
                      [disabled]="busy()"
                      (click)="change(order, next)"
                    >
                      {{ 'admin.order.action.' + next | transloco }}
                    </button>
                  }
                }
              </div>
            }

            @if (confirmingCancel()) {
              <div
                class="mt-4 grid gap-2 rounded-2xl border border-danger/40 bg-danger/5 p-4"
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

          <section class="card p-5">
            <h3 class="mb-3 text-lg font-bold">{{ 'admin.order.items' | transloco }}</h3>
            <ul class="divide-y divide-border">
              @for (item of order.items; track item.productId) {
                <li class="flex items-center gap-3 py-3">
                  @if (item.imageUrl) {
                    <img [src]="item.imageUrl" alt="" class="size-14 rounded-xl object-cover" />
                  }
                  <span class="min-w-0 flex-1">
                    <span class="block font-semibold">{{ item.name }}</span>
                    <span class="text-sm text-muted"
                      >{{ item.quantity }} × {{ item.unitPrice | price }}</span
                    >
                  </span>
                  <span class="font-bold">{{ item.lineTotal | price }}</span>
                </li>
              }
            </ul>
            <p class="mt-2 flex justify-between border-t border-border pt-3 text-lg font-bold">
              <span>{{ 'orders.total' | transloco }}</span>
              <span class="text-accent-hover">{{ order.total | price }}</span>
            </p>
            <p class="text-sm text-muted">{{ 'checkout.cod' | transloco }}</p>
          </section>
        </div>

        <section class="card grid content-start gap-3 p-5">
          <h3 class="text-lg font-bold">{{ 'admin.order.customer' | transloco }}</h3>
          <p class="font-semibold">{{ order.shippingName }}</p>
          <p dir="ltr" class="text-start">{{ order.phone }}</p>
          <div class="flex flex-wrap gap-2">
            <a class="btn" [href]="'tel:' + order.phone">{{ 'admin.order.call' | transloco }}</a>
            <a class="btn" [href]="whatsAppUrl(order)" target="_blank" rel="noopener">
              {{ 'admin.order.whatsapp' | transloco }}
            </a>
          </div>
          <div class="border-t border-border pt-3">
            <p class="text-xs text-muted">{{ 'admin.order.address' | transloco }}</p>
            <p>{{ order.address }}</p>
            <p class="text-muted">{{ order.city }}</p>
            @if (order.latitude !== null && order.longitude !== null) {
              <a
                class="mt-2 inline-block text-sm font-semibold text-accent"
                target="_blank"
                rel="noopener"
                [href]="mapUrl(order)"
              >
                {{ 'orders.viewOnMap' | transloco }}
              </a>
            }
          </div>
          @if (order.notes) {
            <div class="border-t border-border pt-3">
              <p class="text-xs text-muted">{{ 'admin.order.notes' | transloco }}</p>
              <p>{{ order.notes }}</p>
            </div>
          }
        </section>
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
    const text = this.transloco.translate('admin.order.waMessage', {
      name: order.shippingName,
      id: order.id,
    });
    return `https://wa.me/${toWhatsAppNumber(order.phone)}?text=${encodeURIComponent(text)}`;
  }

  protected mapUrl(order: Order): string {
    return `https://www.openstreetmap.org/?mlat=${order.latitude}&mlon=${order.longitude}#map=17/${order.latitude}/${order.longitude}`;
  }
}
