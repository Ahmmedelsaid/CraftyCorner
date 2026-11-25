import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, interval, map, merge, startWith } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from '@shared/core/auth/auth.service';
import { LanguageService } from '@shared/core/i18n/language.service';
import { Icon, IconName } from '@shared/ui/icon';
import { Toasts } from '@shared/ui/toasts';
import { AdminCounters } from './data/admin-counters';

interface NavItem {
  path: string;
  key: string;
  icon: IconName;
  exact: boolean;
  badge?: 'orders' | 'messages';
}

/**
 * إطار لوحة التحكم: سايدبار ثابت (على الموبايل بيتفتح من زرار) + شريط علوي بعنوان الصفحة.
 * صفحة الدخول بتتعرض لوحدها من غير السايدبار.
 */
@Component({
  selector: 'admin-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, Icon, Toasts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-toasts />

    @if (!auth.isAuthenticated()) {
      <div class="flex justify-end gap-2 px-4 py-3">
        <button type="button" class="btn !px-3 !py-2 text-sm" (click)="language.toggle()">
          <app-icon name="globe" [size]="1" />
          {{ 'lang.switchTo' | transloco }}
        </button>
      </div>
      <main class="min-h-[70vh]"><router-outlet /></main>
    } @else {
      <div class="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
        <!-- ستارة الموبايل -->
        @if (menuOpen()) {
          <button
            type="button"
            class="fixed inset-0 z-40 bg-ink/50 lg:hidden"
            [attr.aria-label]="'auth.fields.hidePassword' | transloco"
            (click)="menuOpen.set(false)"
          ></button>
        }

        <aside
          class="fixed inset-y-0 start-0 z-50 flex w-64 flex-col bg-ink text-white/80 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:rtl:translate-x-0"
          [class.-translate-x-full]="!menuOpen()"
          [class.rtl:translate-x-full]="!menuOpen()"
        >
          <div class="flex items-center gap-3 px-5 py-5">
            <img
              src="images/logo.jpg"
              alt=""
              width="40"
              height="40"
              class="size-10 rounded-full ring-2 ring-white/20"
            />
            <div class="leading-tight">
              <p class="font-brand text-xl font-semibold text-white" dir="ltr">Crafty Corner</p>
              <p class="text-xs text-white/60">{{ 'admin.title' | transloco }}</p>
            </div>
          </div>

          <nav class="flex-1 space-y-1 px-3" [attr.aria-label]="'admin.title' | transloco">
            @for (item of nav; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="!bg-white/15 !text-white"
                [routerLinkActiveOptions]="{ exact: item.exact }"
                class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-white/10 hover:text-white"
              >
                <app-icon [name]="item.icon" [size]="1.15" />
                <span class="flex-1">{{ 'admin.nav.' + item.key | transloco }}</span>
                @if (badge(item); as count) {
                  <span
                    class="grid min-w-5 place-items-center rounded-full bg-highlight px-1.5 text-[11px] font-bold leading-5 text-ink"
                    >{{ count }}</span
                  >
                }
              </a>
            }
          </nav>

          <div class="space-y-1 border-t border-white/10 p-3 text-sm">
            <a
              [href]="storeUrl"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white"
            >
              <app-icon name="cart" [size]="1.1" />
              {{ 'admin.viewStore' | transloco }}
            </a>
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white"
              (click)="language.toggle()"
            >
              <app-icon name="globe" [size]="1.1" />
              {{ 'lang.switchTo' | transloco }}
            </button>
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white"
              (click)="logout()"
            >
              <app-icon name="log-out" [size]="1.1" class="rtl:-scale-x-100" />
              {{ 'auth.logout' | transloco }}
            </button>
          </div>
        </aside>

        <div class="min-w-0">
          <header
            class="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur lg:px-8"
          >
            <button
              type="button"
              class="btn !px-2.5 !py-2 lg:hidden"
              [attr.aria-label]="'admin.title' | transloco"
              (click)="menuOpen.set(true)"
            >
              <app-icon name="menu" [size]="1.2" />
            </button>
            <h1 class="text-xl font-bold">{{ title() | transloco }}</h1>
            <span class="ms-auto hidden truncate text-sm text-muted sm:block">
              {{ auth.user()?.fullName }}
            </span>
          </header>
          <main class="mx-auto max-w-[100rem] px-4 py-6 lg:px-8"><router-outlet /></main>
        </div>
      </div>
    }
  `,
})
export class AdminApp {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly storeUrl = environment.storeUrl;
  protected readonly menuOpen = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/', key: 'dashboard', icon: 'bolt', exact: true },
    { path: '/orders', key: 'orders', icon: 'cart', exact: false, badge: 'orders' },
    { path: '/products', key: 'products', icon: 'box', exact: false },
    { path: '/reviews', key: 'reviews', icon: 'star', exact: false },
    { path: '/categories', key: 'categories', icon: 'menu', exact: false },
    { path: '/messages', key: 'messages', icon: 'mail', exact: false, badge: 'messages' },
    { path: '/team', key: 'team', icon: 'user', exact: false },
  ];

  private readonly navigated$ = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
  );

  /** عنوان الصفحة من data.title بتاع أعمق route. */
  protected readonly title = toSignal(
    this.navigated$.pipe(
      startWith(null),
      map(() => {
        let current = this.route.snapshot;
        while (current.firstChild) current = current.firstChild;
        return (current.data['title'] as string | undefined) ?? 'admin.title';
      }),
    ),
    { initialValue: 'admin.title' },
  );

  private readonly counters = inject(AdminCounters);

  protected readonly counts = computed(() => ({
    orders: this.counters.newOrders(),
    messages: this.counters.unreadMessages(),
  }));

  constructor() {
    // refresh on every navigation, and every 30 seconds so a new order appears while the page is just open
    merge(this.navigated$, interval(30_000))
      .pipe(startWith(null), takeUntilDestroyed())
      .subscribe(() => {
        if (this.auth.isAdmin()) this.counters.refresh();
        else this.counters.clear();
      });
  }

  protected badge(item: NavItem): number {
    return item.badge ? this.counts()[item.badge] : 0;
  }

  protected logout(): void {
    this.auth.logout().subscribe(() => {
      this.counters.clear();
      void this.router.navigateByUrl('/login');
    });
  }
}
