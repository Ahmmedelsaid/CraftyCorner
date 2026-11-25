import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CartService } from '../../../core/cart/cart.service';
import { ProductListItem } from '@shared/core/models/api.models';
import { PricePipe } from '@shared/pipes/price.pipe';
import { Icon } from '@shared/ui/icon';
import { LocalizedPipe } from '@shared/pipes/localized.pipe';
import { ImgFade } from '../../../shared/directives/img-fade';

@Component({
  selector: 'app-product-card',
  imports: [ImgFade, LocalizedPipe, RouterLink, TranslocoPipe, PricePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="group/card relative h-full">
      <a
        [routerLink]="['/products', product().id]"
        class="card group flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-glow"
      >
        <div class="arch relative m-2.5 mb-0 grid aspect-[4/5] place-items-center bg-surface-2">
          @if (product().imageUrl) {
            <img
              appImgFade
              [src]="product().imageUrl"
              [alt]="product().name | localized: product().nameEn"
              loading="lazy"
              decoding="async"
              class="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
            />
          } @else {
            <app-icon
              name="box"
              [size]="3"
              class="text-muted/40 transition group-hover:text-accent/70"
            />
          }
        </div>

        <div class="flex flex-1 flex-col gap-1 border-t border-border/70 p-3.5">
          <span class="text-xs font-semibold text-accent">{{
            product().categoryName | localized: product().categoryNameEn
          }}</span>
          <h3 class="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
            {{ product().name | localized: product().nameEn }}
          </h3>

          <div class="mt-auto flex items-end justify-between gap-2 pt-3">
            <p class="text-base font-bold sm:text-lg">{{ product().price | price }}</p>
            <span class="size-10 shrink-0" aria-hidden="true"></span>
          </div>
        </div>
      </a>
      <button
        type="button"
        class="absolute bottom-3 end-3 grid size-10 place-items-center rounded-full bg-accent text-accent-fg shadow-[0_8px_18px_-8px_rgb(111_71_32/0.7)] transition duration-200 group-hover/card:scale-110 hover:bg-accent-hover active:scale-90 disabled:opacity-50"
        [attr.aria-label]="'cart.add' | transloco"
        [disabled]="cart.addingProductId() === product().id"
        (click)="cart.addFromCatalog(product().id)"
      >
        <app-icon name="cart" [size]="1.15" />
      </button>
    </div>
  `,
})
export class ProductCard {
  readonly product = input.required<ProductListItem>();
  protected readonly cart = inject(CartService);
}
