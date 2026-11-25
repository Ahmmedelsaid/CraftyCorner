import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProductListItem } from '@shared/core/models/api.models';
import { Icon } from '@shared/ui/icon';
import { WishlistService } from '../../core/wishlist/wishlist.service';

/** The heart: saves the product to the customer's favourites, or removes it. */
@Component({
  selector: 'app-wishlist-button',
  imports: [Icon, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="grid size-9 place-items-center rounded-full border border-border bg-surface/90 shadow-sm backdrop-blur transition duration-200 hover:scale-110 hover:border-accent/50 active:scale-90"
      [class.text-danger]="saved()"
      [class.text-muted]="!saved()"
      [attr.aria-pressed]="saved()"
      [attr.aria-label]="(saved() ? 'wishlist.remove' : 'wishlist.add') | transloco"
      (click)="toggle($event)"
    >
      <app-icon name="heart" [size]="1.1" [class.fill-current]="saved()" />
    </button>
  `,
})
export class WishlistButton {
  readonly product = input.required<ProductListItem>();

  private readonly wishlist = inject(WishlistService);
  protected saved(): boolean {
    return this.wishlist.has(this.product().id);
  }

  protected toggle(event: Event): void {
    // the button sits on top of a card that is a link: do not open the product
    event.preventDefault();
    event.stopPropagation();
    this.wishlist.toggle(this.product());
  }
}
