import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/** إطار لوحة التحكم: عنوان وتبويبات بتتمرّر أفقياً على الموبايل. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-6xl px-4 py-6">
      <h1 class="mb-4 text-3xl">{{ 'admin.title' | transloco }}</h1>

      <nav
        class="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1"
        [attr.aria-label]="'admin.title' | transloco"
      >
        @for (tab of tabs; track tab.path) {
          <a
            [routerLink]="tab.path"
            routerLinkActive="!bg-accent !text-accent-fg !border-accent"
            [routerLinkActiveOptions]="{ exact: tab.exact }"
            class="whitespace-nowrap rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold transition hover:border-accent/50"
          >
            {{ 'admin.nav.' + tab.key | transloco }}
          </a>
        }
      </nav>

      <router-outlet />
    </div>
  `,
})
export class AdminLayout {
  protected readonly tabs = [
    { path: '/admin', key: 'dashboard', exact: true },
    { path: '/admin/orders', key: 'orders', exact: false },
    { path: '/admin/products', key: 'products', exact: false },
    { path: '/admin/messages', key: 'messages', exact: false },
  ];
}
