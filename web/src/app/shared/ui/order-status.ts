import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { OrderStatus } from '../../core/orders/order.models';

/** شارة حالة الطلب (ملوّنة + نص، فاللون مش هو الوسيلة الوحيدة للتمييز). */
@Component({
  selector: 'app-order-status',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      [class]="tone()"
    >
      {{ 'orders.status.' + status() | transloco }}
    </span>
  `,
})
export class OrderStatusBadge {
  readonly status = input.required<OrderStatus>();

  protected tone(): string {
    switch (this.status()) {
      case 'Cancelled':
        return 'bg-danger/15 text-danger';
      case 'Delivered':
        return 'bg-success/15 text-success';
      case 'Placed':
        return 'bg-highlight/25 text-highlight-strong';
      default:
        return 'bg-accent/15 text-accent';
    }
  }
}
