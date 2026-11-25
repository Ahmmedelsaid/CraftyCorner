import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { of, switchMap } from 'rxjs';
import { ApiError } from '@shared/core/models/api.models';
import { Order } from '@shared/core/orders/order.models';
import { SHOP_WHATSAPP } from '../../core/site';
import { OrdersService, orderErrorKey } from '../../core/orders/orders.service';
import { LoadState, toLoadState } from '@shared/core/state/load-state';
import { DateTimePipe } from '@shared/pipes/date-time.pipe';
import { LocalizedPipe } from '@shared/pipes/localized.pipe';
import { PricePipe } from '@shared/pipes/price.pipe';
import { Icon, IconName } from '@shared/ui/icon';
import { OrderStatusBadge } from '@shared/ui/order-status';
import { Reveal } from '../../shared/directives/reveal';

/** تفاصيل طلب: الحالة، المنتجات، بيانات التوصيل، وإلغاء الطلب لو لسه متاخدش في التنفيذ. */
@Component({
  selector: 'app-order-detail',
  imports: [
    Reveal,
    LocalizedPipe,
    RouterLink,
    TranslocoPipe,
    PricePipe,
    DateTimePipe,
    Icon,
    OrderStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      @let current = state();

      @if (current.status === 'ready') {
        @let order = shown() ?? current.data;

        <a
          routerLink="/orders"
          class="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-accent"
        >
          <app-icon name="chevron-left" [size]="1" class="rtl:rotate-180" />
          {{ 'orders.all' | transloco }}
        </a>

        @if (placed() === '1' && order.status === 'Placed') {
          <section
            role="status"
            class="mb-8 overflow-hidden rounded-3xl border border-success/40 bg-surface text-center shadow-card"
          >
            <div class="bg-success/10 px-6 pb-8 pt-10">
              <span
                class="mx-auto grid size-20 animate-pop place-items-center rounded-full bg-success text-white shadow-lift"
              >
                <app-icon name="check" [size]="2.6" />
              </span>
              <h1 class="mt-5 text-3xl font-bold tracking-tight">
                {{ 'orders.placedTitle' | transloco }}
              </h1>
              <p class="mx-auto mt-2 max-w-md text-muted">{{ 'orders.placedText' | transloco }}</p>
              <p
                class="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm"
              >
                <span class="text-muted">{{ 'orders.placedNumber' | transloco }}</span>
                <b class="tabular-nums">#{{ order.id }}</b>
              </p>
            </div>

            <div class="px-6 py-7">
              <h2 class="mb-4 text-sm font-bold text-muted">
                {{ 'orders.next.title' | transloco }}
              </h2>
              <ol class="mx-auto grid max-w-2xl gap-5 text-start sm:grid-cols-3">
                @for (step of nextSteps; track step.key; let i = $index) {
                  <li class="flex items-start gap-3">
                    <span
                      class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold"
                      [class]="i === 0 ? 'bg-success text-white' : 'bg-accent-soft text-accent'"
                    >
                      @if (i === 0) {
                        <app-icon name="check" [size]="1" />
                      } @else {
                        {{ i + 1 }}
                      }
                    </span>
                    <p class="text-sm leading-relaxed">
                      {{ 'orders.next.' + step.key | transloco }}
                    </p>
                  </li>
                }
              </ol>

              <div class="mt-8 flex flex-wrap justify-center gap-3">
                @if (whatsappNumber) {
                  <a
                    [href]="whatsappUrl(order)"
                    target="_blank"
                    rel="noopener"
                    class="btn btn-accent px-5 py-3"
                  >
                    {{ 'orders.whatsapp.button' | transloco }}
                  </a>
                }
                <a routerLink="/products" class="btn px-5 py-3">
                  {{ 'orders.continue' | transloco }}
                </a>
              </div>
            </div>
          </section>
        } @else {
          <header
            class="mb-5 flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6"
          >
            <div class="grid gap-1.5">
              <div class="flex flex-wrap items-center gap-3">
                <h1 class="text-3xl font-bold tracking-tight">
                  {{ 'orders.number' | transloco: { id: order.id } }}
                </h1>
                <app-order-status [status]="order.status" />
              </div>
              <p class="text-sm text-muted">
                {{ 'orders.placedOn' | transloco }} {{ order.createdAt | dateTime }}
              </p>
            </div>
            <div class="text-end">
              <p class="text-xs font-medium text-muted">{{ 'orders.total' | transloco }}</p>
              <p class="text-2xl font-bold text-accent">{{ order.total | price }}</p>
            </div>
          </header>
        }

        <!-- where the order is, and what that means for the customer -->
        @if (order.status === 'Cancelled') {
          <section
            role="status"
            class="mb-5 flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/5 p-4"
          >
            <app-icon name="x" [size]="1.3" class="mt-0.5 text-danger" />
            <div>
              <h2 class="font-semibold">{{ 'orders.status.Cancelled' | transloco }}</h2>
              <p class="text-sm text-muted">{{ 'orders.statusNote.Cancelled' | transloco }}</p>
              @if (order.cancelledAt) {
                <p class="mt-1 text-xs text-muted">{{ order.cancelledAt | dateTime }}</p>
              }
            </div>
          </section>
        } @else {
          <section
            class="mb-5 rounded-2xl border border-border bg-surface p-5 sm:p-6"
            [attr.aria-label]="'orders.title' | transloco"
          >
            <ol class="relative grid grid-cols-5">
              <!-- the line behind the steps, and how far it is filled -->
              <span
                aria-hidden="true"
                class="absolute inset-x-[10%] top-5 h-0.5 rounded-full bg-border"
              ></span>
              <span
                aria-hidden="true"
                class="absolute start-[10%] top-5 h-0.5 rounded-full bg-accent transition-all duration-700"
                [style.width.%]="progress(order.status)"
              ></span>

              @for (step of trackSteps; track step.key; let i = $index) {
                <li class="relative flex flex-col items-center gap-2 text-center">
                  <span
                    class="grid size-10 place-items-center rounded-full border-2 transition"
                    [class]="
                      i < stepIndex(order.status)
                        ? 'border-accent bg-accent text-accent-fg'
                        : i === stepIndex(order.status)
                          ? 'border-accent bg-surface text-accent shadow-[0_0_0_4px_rgb(111_71_32/0.15)]'
                          : 'border-border bg-surface text-muted'
                    "
                    [attr.aria-current]="i === stepIndex(order.status) ? 'step' : null"
                  >
                    @if (i < stepIndex(order.status)) {
                      <app-icon name="check" [size]="1.1" />
                    } @else {
                      <app-icon [name]="step.icon" [size]="1.1" />
                    }
                  </span>
                  <span
                    class="text-[11px] leading-tight sm:text-sm"
                    [class]="i === stepIndex(order.status) ? 'font-bold text-fg' : 'text-muted'"
                  >
                    {{ 'orders.status.' + step.key | transloco }}
                  </span>
                </li>
              }
            </ol>

            <p
              class="mt-5 rounded-xl bg-accent-soft/60 px-4 py-3 text-sm leading-relaxed"
              role="status"
            >
              {{ 'orders.statusNote.' + order.status | transloco }}
            </p>
          </section>
        }

        @if (errorKey(); as key) {
          <p
            role="alert"
            class="mb-4 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm"
          >
            {{ key | transloco }}
          </p>
        }

        <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div class="grid content-start gap-5">
            <section class="overflow-hidden rounded-2xl border border-border bg-surface">
              <h2 class="border-b border-border px-5 py-4 font-bold">
                {{ 'cart.items' | transloco: { count: order.itemCount } }}
              </h2>
              <ul class="divide-y divide-border">
                @for (item of order.items; track item.productId) {
                  <li class="flex items-center gap-4 p-4 sm:px-5">
                    <a
                      [routerLink]="['/products', item.productId]"
                      class="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl"
                      [class.bg-photo]="item.imageUrl"
                      [class.bg-surface-2]="!item.imageUrl"
                    >
                      @if (item.imageUrl) {
                        <img
                          [src]="item.imageUrl"
                          [alt]="item.name | localized: item.nameEn"
                          class="absolute inset-0 size-full object-contain p-1.5 mix-blend-multiply"
                        />
                      } @else {
                        <app-icon name="box" [size]="1.8" class="text-muted/40" />
                      }
                    </a>
                    <div class="min-w-0 flex-1">
                      <a
                        [routerLink]="['/products', item.productId]"
                        class="line-clamp-2 font-semibold leading-snug hover:text-accent"
                      >
                        {{ item.name | localized: item.nameEn }}
                      </a>
                      <p class="mt-1 text-sm text-muted">
                        {{ item.unitPrice | price }} × {{ item.quantity }}
                      </p>
                    </div>
                    <p class="font-bold">{{ item.lineTotal | price }}</p>
                  </li>
                }
              </ul>

              <dl class="grid gap-2 border-t border-border bg-surface-2/40 px-5 py-4 text-sm">
                <div class="flex justify-between">
                  <dt class="text-muted">{{ 'cart.subtotal' | transloco }}</dt>
                  <dd class="font-medium">{{ order.total - order.shippingFee | price }}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-muted">{{ 'orders.delivery' | transloco }}</dt>
                  <dd class="font-medium">
                    @if (order.shippingFee > 0) {
                      {{ order.shippingFee | price }}
                    } @else {
                      {{ 'orders.deliveryNote' | transloco }}
                    }
                  </dd>
                </div>
                <div class="flex justify-between border-t border-border pt-3 text-base font-bold">
                  <dt>{{ 'orders.total' | transloco }}</dt>
                  <dd class="text-accent">{{ order.total | price }}</dd>
                </div>
              </dl>
            </section>

            <section class="grid gap-4 rounded-2xl border border-border bg-surface p-5">
              <h2 class="flex items-center gap-2 font-bold">
                <app-icon name="pin" [size]="1.1" class="text-accent" />
                {{ 'checkout.shipping' | transloco }}
              </h2>
              <div class="grid gap-5 sm:grid-cols-2">
                <ul class="grid content-start gap-3 text-sm">
                  <li class="flex items-start gap-3">
                    <app-icon name="user" [size]="1.05" class="mt-0.5 shrink-0 text-accent" />
                    <span class="font-medium">{{ order.shippingName }}</span>
                  </li>
                  <li class="flex items-start gap-3">
                    <app-icon name="phone" [size]="1.05" class="mt-0.5 shrink-0 text-accent" />
                    <span dir="ltr">{{ order.phone }}</span>
                  </li>
                  <li class="flex items-start gap-3">
                    <app-icon name="pin" [size]="1.05" class="mt-0.5 shrink-0 text-accent" />
                    <span class="leading-relaxed">{{ order.address }}, {{ order.city }}</span>
                  </li>
                </ul>
                <div class="grid content-start gap-3">
                  @if (order.notes) {
                    <p
                      class="rounded-lg bg-surface-2/60 px-3 py-2 text-sm leading-relaxed text-muted"
                    >
                      {{ order.notes }}
                    </p>
                  }
                  @if (order.latitude !== null && order.longitude !== null) {
                    <a
                      class="btn justify-self-start"
                      target="_blank"
                      rel="noopener"
                      [href]="mapUrl(order.latitude, order.longitude)"
                    >
                      <app-icon name="pin" [size]="1" />
                      {{ 'orders.viewOnMap' | transloco }}
                    </a>
                  }
                </div>
              </div>
            </section>
          </div>

          <aside appReveal class="grid gap-4">
            @if (order.trackingNumber) {
              <section class="grid gap-2 rounded-2xl border border-accent/40 bg-accent-soft/40 p-5">
                <h2 class="flex items-center gap-2 font-semibold">
                  <app-icon name="truck" [size]="1.1" class="text-accent" />
                  {{ 'orders.tracking.title' | transloco }}
                </h2>
                @if (order.trackingCompany) {
                  <p class="text-sm">
                    <span class="text-muted">{{ 'orders.tracking.company' | transloco }}:</span>
                    {{ order.trackingCompany }}
                  </p>
                }
                <p class="text-sm">
                  <span class="text-muted">{{ 'orders.tracking.number' | transloco }}:</span>
                  <b dir="ltr" class="ms-1 tabular-nums">{{ order.trackingNumber }}</b>
                </p>
              </section>
            }

            <section class="grid gap-1 rounded-2xl border border-border bg-surface p-5">
              <h2 class="font-bold">{{ 'checkout.payment' | transloco }}</h2>
              <p class="flex items-center gap-2 text-sm text-muted">
                <app-icon name="cash" [size]="1.05" class="shrink-0 text-accent" />
                {{ 'checkout.cod' | transloco }}
              </p>
            </section>

            <section class="grid gap-3 rounded-2xl border border-border bg-surface p-5">
              <h2 class="font-bold">{{ 'orders.help.title' | transloco }}</h2>
              <p class="text-sm text-muted">{{ 'orders.help.text' | transloco }}</p>
              <div class="flex flex-wrap gap-2">
                <!-- a chat about an order that was cancelled has nothing to say: only the form is offered -->
                @if (whatsappNumber && order.status !== 'Cancelled') {
                  <a
                    [href]="whatsappUrl(order)"
                    target="_blank"
                    rel="noopener"
                    class="btn btn-accent flex-1"
                  >
                    {{ 'orders.whatsapp.button' | transloco }}
                  </a>
                }
                <a
                  routerLink="/contact"
                  [queryParams]="{ topic: 'order', order: order.id }"
                  class="btn flex-1"
                >
                  {{ 'orders.help.contact' | transloco }}
                </a>
              </div>
            </section>

            @if (order.status === 'Placed') {
              @if (confirming()) {
                <div class="grid gap-3 rounded-2xl border border-danger/40 bg-danger/5 p-4">
                  <p class="text-sm">{{ 'orders.cancelConfirm' | transloco }}</p>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="btn flex-1 !border-danger !text-danger"
                      [disabled]="cancelling()"
                      (click)="cancel(order)"
                    >
                      {{ (cancelling() ? 'orders.cancelling' : 'orders.cancelYes') | transloco }}
                    </button>
                    <button
                      type="button"
                      class="btn flex-1"
                      [disabled]="cancelling()"
                      (click)="confirming.set(false)"
                    >
                      {{ 'orders.cancelNo' | transloco }}
                    </button>
                  </div>
                </div>
              } @else {
                <button
                  type="button"
                  class="btn !border-danger/50 !text-danger hover:!bg-danger/5"
                  (click)="confirming.set(true)"
                >
                  {{ 'orders.cancel' | transloco }}
                </button>
              }
            }
          </aside>
        </div>
      } @else if (current.status === 'error') {
        <div
          role="alert"
          class="mx-auto grid max-w-lg place-items-center gap-3 rounded-2xl border border-danger/40 bg-danger/5 px-6 py-14 text-center"
        >
          <h1 class="text-lg font-semibold">{{ 'orders.notFoundTitle' | transloco }}</h1>
          <p class="text-muted">{{ loadErrorKey() | transloco }}</p>
          <a routerLink="/orders" class="btn">{{ 'orders.all' | transloco }}</a>
        </div>
      } @else {
        <div class="grid gap-4" aria-hidden="true">
          <div class="h-10 w-64 skeleton rounded"></div>
          <div class="h-28 skeleton rounded-2xl"></div>
          <div class="h-48 skeleton rounded-2xl"></div>
        </div>
      }
    </div>
  `,
})
export class OrderDetail {
  /** من الـ route (orders/:id) و ?placed=1 بعد إتمام الطلب، بفضل withComponentInputBinding. */
  readonly id = input.required<string>();
  readonly placed = input<string>();

  private readonly orders = inject(OrdersService);
  private readonly transloco = inject(TranslocoService);

  /** رقم واتساب المتجر (من site.ts). فاضي = الزرار مخفي. */
  protected readonly whatsappNumber = inject(SHOP_WHATSAPP);

  protected readonly nextSteps = [{ key: 'received' }, { key: 'call' }, { key: 'deliver' }];
  protected readonly trackSteps: { key: string; icon: IconName }[] = [
    { key: 'Placed', icon: 'clock' },
    { key: 'Confirmed', icon: 'check' },
    { key: 'Preparing', icon: 'box' },
    { key: 'Shipped', icon: 'truck' },
    { key: 'Delivered', icon: 'pin' },
  ];

  protected stepIndex(status: string): number {
    return this.trackSteps.findIndex((step) => step.key === status);
  }

  /** How far the line between the first and the last step is filled (the line spans 80% of the row). */
  protected progress(status: string): number {
    const index = Math.max(0, this.stepIndex(status));
    return (index / (this.trackSteps.length - 1)) * 80;
  }

  /** الطلب بعد الإلغاء (الرد الجديد من الـ API بيحل محل النسخة المحمّلة). */
  protected readonly shown = signal<Order | null>(null);
  protected readonly confirming = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected readonly state = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => {
        const orderId = Number(id);
        if (!Number.isInteger(orderId) || orderId < 1) {
          return of<LoadState<Order>>({
            status: 'error',
            error: { status: 404, title: 'Not found' },
          });
        }
        this.shown.set(null);
        return this.orders.get(orderId).pipe(toLoadState());
      }),
    ),
    { initialValue: { status: 'loading' } as LoadState<Order> },
  );

  protected readonly loadErrorKey = computed(() => {
    const current = this.state();
    return current.status === 'error' ? orderErrorKey(current.error) : '';
  });

  /** رابط wa.me بيفتح الشات مع المتجر ورسالة جاهزة فيها بيانات الطلب (العميل هو اللي بيضغط إرسال). */
  protected whatsappUrl(order: Order): string {
    const text = this.transloco.translate('orders.whatsapp.message', {
      id: order.id,
      total: order.total.toLocaleString('en-US'),
      name: order.shippingName,
      phone: order.phone,
    });
    return `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(text)}`;
  }

  protected mapUrl(lat: number, lng: number): string {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  }

  protected cancel(order: Order): void {
    this.cancelling.set(true);
    this.errorKey.set(null);
    this.orders.cancel(order.id).subscribe({
      next: (updated) => {
        this.shown.set(updated);
        this.cancelling.set(false);
        this.confirming.set(false);
      },
      error: (error: ApiError) => {
        this.cancelling.set(false);
        this.confirming.set(false);
        this.errorKey.set(
          error.status === 409 ? 'orders.errors.cannotCancel' : orderErrorKey(error),
        );
      },
    });
  }
}
