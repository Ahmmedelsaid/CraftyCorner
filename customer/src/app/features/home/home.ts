import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { GOVERNORATES } from '../../core/geo/governorates';
import { Category, PagedResult, ProductListItem } from '../../core/models/api.models';
import { CatalogService } from '../../core/services/catalog.service';
import { ProductsService } from '../../core/services/products.service';
import { LoadState, toLoadState } from '../../core/state/load-state';
import { CountUp } from '../../shared/directives/count-up';
import { Reveal } from '../../shared/directives/reveal';
import { Icon, IconName } from '../../shared/ui/icon';
import { ProductCard } from '../products/product-card/product-card';

interface CategorySection {
  category: Category;
  items: ProductListItem[];
}

/** الأقسام الأكبر الأول (أكتر منتجات)، عشان الصفحة الرئيسية تبدأ بالأهم. */
function byPopularity(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => b.productCount - a.productCount);
}

/** الصفحة الرئيسية: بانر بإطارات قوس، مميزات، أقسام بصور، وصل حديثاً، منتجات كل قسم، وخطوات الطلب. */
@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslocoPipe, Icon, ProductCard, Reveal, CountUp],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-4 pb-4 pt-8">
      <section aria-labelledby="hero-title">
        <div class="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p class="eyebrow animate-fade-up">{{ 'home.eyebrow' | transloco }}</p>
            <h1
              id="hero-title"
              class="animate-fade-up mt-4 max-w-xl text-balance text-5xl leading-[1.2] [animation-delay:90ms] sm:text-6xl"
            >
              {{ 'home.title' | transloco }}
            </h1>
            <p class="animate-fade-up mt-5 max-w-lg text-lg text-muted [animation-delay:180ms]">
              {{ 'home.subtitle' | transloco }}
            </p>

            <div class="animate-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:270ms]">
              <a routerLink="/products" class="btn btn-accent !rounded-full !px-7 !py-3 !text-base">
                {{ 'home.shopNow' | transloco }}
              </a>
              <a
                routerLink="/products"
                [queryParams]="{ sort: 'newest' }"
                class="btn !rounded-full !border-accent !px-7 !py-3 !text-base !text-accent"
              >
                {{ 'home.newArrivals' | transloco }}
              </a>
            </div>

            <dl
              class="animate-fade-up mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6 [animation-delay:360ms]"
            >
              <div>
                <dt class="sr-only">{{ 'home.stats.products' | transloco }}</dt>
                <dd class="text-3xl font-bold tabular-nums text-accent-hover">
                  <span dir="ltr" class="inline-block" [appCountUp]="totalProducts()"></span>
                </dd>
                <p class="text-xs text-muted" aria-hidden="true">
                  {{ 'home.stats.products' | transloco }}
                </p>
              </div>
              <div>
                <dt class="sr-only">{{ 'home.stats.categories' | transloco }}</dt>
                <dd class="text-3xl font-bold tabular-nums text-accent-hover">
                  <span dir="ltr" class="inline-block" [appCountUp]="subCategories().length"></span>
                </dd>
                <p class="text-xs text-muted" aria-hidden="true">
                  {{ 'home.stats.categories' | transloco }}
                </p>
              </div>
              <div>
                <dt class="sr-only">{{ 'home.stats.governorates' | transloco }}</dt>
                <dd class="text-3xl font-bold tabular-nums text-accent-hover">
                  <span dir="ltr" class="inline-block" [appCountUp]="governorateCount"></span>
                </dd>
                <p class="text-xs text-muted" aria-hidden="true">
                  {{ 'home.stats.governorates' | transloco }}
                </p>
              </div>
            </dl>
          </div>

          @if (heroProducts().length >= 3) {
            <div class="relative mx-auto hidden h-[30rem] w-full max-w-lg lg:block">
              <a
                [routerLink]="['/products', heroProducts()[0].id]"
                class="arch animate-float absolute end-0 top-0 h-[78%] w-[56%] border-[6px] border-surface shadow-lift"
                [style.--tilt]="'0deg'"
              >
                <img [src]="heroProducts()[0].imageUrl" [alt]="heroProducts()[0].name" />
              </a>
              <a
                [routerLink]="['/products', heroProducts()[1].id]"
                class="arch animate-float absolute start-0 top-[14%] h-[52%] w-[44%] border-[6px] border-surface shadow-lift [animation-delay:-2s]"
                [style.--tilt]="'0deg'"
              >
                <img [src]="heroProducts()[1].imageUrl" [alt]="heroProducts()[1].name" />
              </a>
              <a
                [routerLink]="['/products', heroProducts()[2].id]"
                class="arch animate-float absolute bottom-0 start-[18%] h-[40%] w-[40%] border-[6px] border-surface shadow-lift [animation-delay:-4s]"
                [style.--tilt]="'0deg'"
              >
                <img [src]="heroProducts()[2].imageUrl" [alt]="heroProducts()[2].name" />
              </a>
              <span
                aria-hidden="true"
                class="absolute bottom-[6%] start-[2%] grid size-24 rotate-[-10deg] place-items-center rounded-full border-2 border-dashed border-white/60 bg-highlight-strong text-center text-xs font-bold leading-snug text-white shadow-lift"
              >
                Made<br />with ♥<br />by hand
              </span>
            </div>
          }
        </div>
      </section>

      <section aria-label="Highlights">
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (value of values; track value.key; let i = $index) {
            <li
              [appReveal]="i * 80"
              class="card group flex items-center gap-3 p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <span
                class="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent transition duration-300 group-hover:rotate-[-6deg] group-hover:scale-110 group-hover:bg-accent group-hover:text-accent-fg"
              >
                <app-icon [name]="value.icon" [size]="1.4" />
              </span>
              <div>
                <p class="text-sm font-semibold">
                  {{ 'home.values.' + value.key + '.title' | transloco }}
                </p>
                <p class="text-xs text-muted">
                  {{ 'home.values.' + value.key + '.text' | transloco }}
                </p>
              </div>
            </li>
          }
        </ul>
      </section>

      @if (subCategories().length) {
        <section aria-labelledby="cats-title">
          <div class="mb-8 text-center">
            <h2 id="cats-title" appReveal class="font-display text-3xl sm:text-4xl">
              {{ 'home.shopByCategory' | transloco }}
            </h2>
            <div class="wavy" aria-hidden="true"></div>
          </div>
          <ul class="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            @for (category of subCategories(); track category.id; let i = $index) {
              <li [appReveal]="(i % 4) * 70">
                <a
                  routerLink="/products"
                  [queryParams]="{ categoryId: category.id }"
                  class="group block text-center"
                >
                  <div
                    class="arch aspect-[3/4] shadow-card transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-lift"
                  >
                    @if (categoryImage(category.id); as image) {
                      <img
                        [src]="image"
                        alt=""
                        class="transition duration-500 group-hover:scale-105"
                      />
                    }
                  </div>
                  <span class="mt-3 block text-lg font-bold">{{ category.name }}</span>
                  <span class="text-sm text-muted">
                    {{ 'home.products' | transloco: { count: category.productCount } }}
                  </span>
                </a>
              </li>
            }
          </ul>
        </section>
      }

      <section aria-labelledby="new-title">
        <div appReveal class="mb-5 flex items-end justify-between gap-3">
          <h2 id="new-title" class="font-display text-3xl sm:text-4xl">
            {{ 'home.newArrivals' | transloco }}
          </h2>
          <a
            routerLink="/products"
            [queryParams]="{ sort: 'newest' }"
            class="group inline-flex items-center gap-1 text-sm font-semibold text-accent"
          >
            {{ 'home.viewAll' | transloco }}
            <app-icon
              name="chevron-right"
              [size]="1"
              class="transition group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
            />
          </a>
        </div>
        @let current = newest();
        @if (current.status === 'ready') {
          <ul class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            @for (product of current.data.items; track product.id; let i = $index) {
              <li [appReveal]="(i % 4) * 80"><app-product-card [product]="product" /></li>
            }
          </ul>
        } @else if (current.status === 'loading') {
          <ul class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-hidden="true">
            @for (placeholder of skeletons; track placeholder) {
              <li class="card skeleton aspect-[4/5]"></li>
            }
          </ul>
        }
      </section>

      @for (section of sections(); track section.category.id) {
        <section [attr.aria-label]="section.category.name">
          <div appReveal class="mb-5 flex items-end justify-between gap-3">
            <h2 class="font-display text-3xl">{{ section.category.name }}</h2>
            <a
              routerLink="/products"
              [queryParams]="{ categoryId: section.category.id }"
              class="group inline-flex items-center gap-1 text-sm font-semibold text-accent"
            >
              {{ 'home.viewAll' | transloco }}
              <app-icon
                name="chevron-right"
                [size]="1"
                class="transition group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
              />
            </a>
          </div>
          <ul class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            @for (product of section.items; track product.id; let i = $index) {
              <li [appReveal]="(i % 4) * 80"><app-product-card [product]="product" /></li>
            }
          </ul>
        </section>
      }

      <section aria-labelledby="how-title">
        <div class="mb-8 text-center">
          <h2 id="how-title" appReveal class="font-display text-3xl sm:text-4xl">
            {{ 'home.how.title' | transloco }}
          </h2>
          <div class="wavy" aria-hidden="true"></div>
        </div>
        <ol class="grid gap-4 md:grid-cols-3">
          @for (step of steps; track step; let i = $index) {
            <li [appReveal]="i * 90" class="card p-6 text-center">
              <span
                class="mx-auto mb-3 grid size-12 place-items-center rounded-full border border-dashed border-highlight bg-surface-2 text-xl font-bold text-accent"
                aria-hidden="true"
              >
                {{ i + 1 }}
              </span>
              <h3 class="text-xl font-bold">{{ 'home.how.' + step + '.title' | transloco }}</h3>
              <p class="mt-1 text-sm text-muted">{{ 'home.how.' + step + '.text' | transloco }}</p>
            </li>
          }
        </ol>
      </section>
    </div>
  `,
})
export class Home {
  private readonly products = inject(ProductsService);
  private readonly catalog = inject(CatalogService);

  protected readonly skeletons = Array.from({ length: 8 }, (_, i) => i);
  protected readonly governorateCount = GOVERNORATES.length;
  protected readonly steps = ['choose', 'order', 'receive'];
  protected readonly values: { key: string; icon: IconName }[] = [
    { key: 'cod', icon: 'cash' },
    { key: 'delivery', icon: 'truck' },
    { key: 'handmade', icon: 'box' },
    { key: 'support', icon: 'chat' },
  ];

  protected readonly newest = toSignal(
    this.products.list({ sort: 'newest', pageSize: 8 }).pipe(toLoadState()),
    { initialValue: { status: 'loading' } as LoadState<PagedResult<ProductListItem>> },
  );

  private readonly categories = toSignal(
    this.catalog.categories$.pipe(catchError(() => of<Category[]>([]))),
    { initialValue: [] as Category[] },
  );

  protected readonly subCategories = computed(() =>
    byPopularity(this.categories().filter((category) => category.parentId !== null)),
  );

  /** عدد المنتجات الكلي (من نتيجة "وصل حديثاً") لعدّاد البانر. */
  protected readonly totalProducts = computed(() => {
    const current = this.newest();
    return current.status === 'ready' ? current.data.totalCount : 0;
  });

  /** أول 3 منتجات وصلت حديثاً بصورها في البانر. */
  protected readonly heroProducts = computed(() => {
    const current = this.newest();
    return current.status === 'ready'
      ? current.data.items.filter((item) => item.imageUrl).slice(0, 3)
      : [];
  });

  /** صف منتجات لكل قسم فيه منتجات (أول 4 أقسام). */
  protected readonly sections = toSignal(
    this.catalog.categories$.pipe(
      map((categories) =>
        byPopularity(
          categories.filter((category) => category.parentId !== null && category.productCount > 0),
        ).slice(0, 4),
      ),
      switchMap((categories) =>
        categories.length === 0
          ? of<CategorySection[]>([])
          : forkJoin(
              categories.map((category) =>
                this.products
                  .list({ categoryId: category.id, pageSize: 4 })
                  .pipe(map((result) => ({ category, items: result.items }))),
              ),
            ),
      ),
      catchError(() => of<CategorySection[]>([])),
    ),
    { initialValue: [] as CategorySection[] },
  );

  /** صورة القسم = صورة أول منتج فيه (القسم نفسه مالوش صورة). */
  protected categoryImage(categoryId: number): string | null {
    const section = this.sections().find((s) => s.category.id === categoryId);
    return section?.items.find((item) => item.imageUrl)?.imageUrl ?? null;
  }
}
