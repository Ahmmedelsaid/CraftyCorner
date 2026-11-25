import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, map, of } from 'rxjs';
import { ShopService } from '../../core/shop/shop.service';
import { Category } from '@shared/core/models/api.models';
import { CatalogService } from '@shared/core/services/catalog.service';
import { ProductsService } from '../../core/services/products.service';
import { Icon, IconName } from '@shared/ui/icon';

/** من نحن: القصة، أرقام حية من الكتالوج، القيم، خطوات الطلب. */
@Component({
  selector: 'app-about',
  imports: [RouterLink, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto grid max-w-7xl gap-12 px-4 pt-6">
      <header
        class="relative isolate overflow-hidden rounded-3xl bg-ink px-6 py-10 text-white shadow-lift sm:px-12 sm:py-14"
      >
        <span
          aria-hidden="true"
          class="pointer-events-none absolute -end-24 -top-28 -z-10 size-96 rounded-full bg-accent/40 blur-3xl"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute -bottom-28 end-12 -z-10 hidden h-64 w-52 rounded-t-full border border-white/15 sm:block"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute -bottom-28 end-28 -z-10 hidden h-48 w-36 rounded-t-full border border-white/10 sm:block"
        ></span>
        <p
          class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide"
        >
          <app-icon name="heart" [size]="0.9" />
          {{ 'about.eyebrow' | transloco }}
        </p>
        <h1 class="mt-5 max-w-2xl font-display text-4xl leading-tight sm:text-6xl">
          {{ 'about.title' | transloco }}
        </h1>
        <p class="mt-5 max-w-2xl text-white/80 sm:text-lg">{{ 'about.subtitle' | transloco }}</p>
        <div class="mt-7 flex flex-wrap gap-3">
          <a routerLink="/products" class="btn btn-accent px-6 py-2.5">
            {{ 'about.cta.shop' | transloco }}
          </a>
          <a
            routerLink="/contact"
            class="btn !border-white/30 !bg-white/10 !text-white hover:!bg-white/20"
          >
            {{ 'about.cta.contact' | transloco }}
          </a>
        </div>
      </header>

      <section class="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]" aria-labelledby="story">
        <div>
          <h2 id="story" class="section-title">{{ 'about.storyTitle' | transloco }}</h2>
          <p class="mt-4 leading-relaxed text-muted">{{ 'about.story1' | transloco }}</p>
          <p class="mt-3 leading-relaxed text-muted">{{ 'about.story2' | transloco }}</p>
        </div>

        <ul class="grid grid-cols-3 gap-3">
          @for (stat of stats(); track stat.key) {
            <li class="card grid place-items-center gap-1 px-2 py-6 text-center">
              <span class="text-3xl font-bold text-accent sm:text-4xl" dir="ltr">
                {{ stat.value }}
              </span>
              <span class="text-xs text-muted sm:text-sm">
                {{ 'about.stats.' + stat.key | transloco }}
              </span>
            </li>
          }
        </ul>
      </section>

      <section aria-labelledby="values">
        <h2 id="values" class="section-title mb-4">{{ 'about.valuesTitle' | transloco }}</h2>
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (value of values; track value.key) {
            <li class="card grid content-start gap-3 p-5">
              <span class="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
                <app-icon [name]="value.icon" [size]="1.4" />
              </span>
              <h3 class="font-semibold">
                {{ 'about.values.' + value.key + '.title' | transloco }}
              </h3>
              <p class="text-sm leading-relaxed text-muted">
                {{ 'about.values.' + value.key + '.text' | transloco }}
              </p>
            </li>
          }
        </ul>
      </section>

      <section aria-labelledby="steps">
        <h2 id="steps" class="section-title mb-4">{{ 'about.stepsTitle' | transloco }}</h2>
        <ol class="grid gap-3 md:grid-cols-3">
          @for (step of steps; track step; let i = $index) {
            <li class="card flex gap-4 p-5">
              <span class="step">{{ i + 1 }}</span>
              <div>
                <h3 class="font-semibold">{{ 'about.steps.' + step + '.title' | transloco }}</h3>
                <p class="mt-1 text-sm leading-relaxed text-muted">
                  {{ 'about.steps.' + step + '.text' | transloco }}
                </p>
              </div>
            </li>
          }
        </ol>
      </section>

      <section
        class="card grid items-center gap-4 bg-accent-soft p-6 sm:grid-cols-[1fr_auto] sm:p-8"
        aria-labelledby="cta"
      >
        <div>
          <h2 id="cta" class="text-xl font-bold sm:text-2xl">{{ 'about.ctaTitle' | transloco }}</h2>
          <p class="mt-1 text-muted">{{ 'about.ctaText' | transloco }}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <a routerLink="/products" class="btn btn-accent px-5 py-3">
            {{ 'about.shop' | transloco }}
          </a>
          <a routerLink="/contact" class="btn px-5 py-3">{{ 'about.contact' | transloco }}</a>
        </div>
      </section>
    </div>
  `,
})
export class About {
  private readonly shop = inject(ShopService);
  private readonly products = inject(ProductsService);
  private readonly catalog = inject(CatalogService);

  protected readonly values: { key: string; icon: IconName }[] = [
    { key: 'genuine', icon: 'shield' },
    { key: 'prices', icon: 'cash' },
    { key: 'delivery', icon: 'truck' },
    { key: 'support', icon: 'headset' },
  ];
  protected readonly steps = ['choose', 'order', 'receive'];

  private readonly productCount = toSignal(
    this.products.list({ pageSize: 1 }).pipe(
      map((result) => result.totalCount),
      catchError(() => of<number | null>(null)),
    ),
    { initialValue: null },
  );

  private readonly categoryCount = toSignal(
    this.catalog.categories$.pipe(
      map((categories: Category[]) => categories.filter((c) => c.parentId !== null).length),
      catchError(() => of<number | null>(null)),
    ),
    { initialValue: null },
  );

  /** أرقام حقيقية من الكتالوج؛ لو الـ API مش متاح بنعرض اللي معانا بس. */
  protected readonly stats = computed(() => {
    const items: { key: string; value: string }[] = [];
    const products = this.productCount();
    const categories = this.categoryCount();
    if (products !== null) items.push({ key: 'products', value: `${products}+` });
    if (categories !== null) items.push({ key: 'categories', value: `${categories}` });
    items.push({ key: 'governorates', value: `${this.shop.governorates().length}` });
    return items;
  });
}
