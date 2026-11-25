import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/ui/icon';
import { WishlistService } from '../../core/wishlist/wishlist.service';
import { ProductCard } from '../products/product-card/product-card';

/** The customer's saved products. */
@Component({
  selector: 'app-wishlist',
  imports: [ProductCard, RouterLink, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-7xl px-4 py-10">
      <h1 class="mb-1 font-display text-3xl">{{ 'wishlist.title' | transloco }}</h1>
      <p class="mb-8 text-muted">{{ 'wishlist.subtitle' | transloco }}</p>

      @if (!wishlist.loaded()) {
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4" aria-hidden="true">
          @for (n of [1, 2, 3, 4]; track n) {
            <div class="aspect-[4/5] skeleton rounded-2xl"></div>
          }
        </div>
      } @else if (wishlist.items().length === 0) {
        <div class="card grid place-items-center gap-3 px-6 py-14 text-center">
          <app-icon name="heart" [size]="2.4" class="text-muted/50" />
          <p class="font-semibold">{{ 'wishlist.empty' | transloco }}</p>
          <p class="max-w-sm text-sm text-muted">{{ 'wishlist.emptyHint' | transloco }}</p>
          <a routerLink="/products" class="btn btn-accent mt-2">
            {{ 'wishlist.browse' | transloco }}
          </a>
        </div>
      } @else {
        <ul class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          @for (product of wishlist.items(); track product.id) {
            <li><app-product-card [product]="product" /></li>
          }
        </ul>
      }
    </section>
  `,
})
export class Wishlist {
  protected readonly wishlist = inject(WishlistService);
}
