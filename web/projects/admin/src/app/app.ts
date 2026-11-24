import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { environment } from '@env/environment';
import { AuthService } from '@web/core/auth/auth.service';
import { LanguageService } from '@web/core/i18n/language.service';
import { Icon } from '@web/shared/ui/icon';
import { Toasts } from '@web/shared/ui/toasts';

/** إطار لوحة التحكم: شريط علوي فيه الاسم، رابط للمتجر، اللغة والخروج. */
@Component({
  selector: 'admin-root',
  imports: [RouterOutlet, TranslocoPipe, Icon, Toasts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="border-b border-border bg-surface">
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <img
          src="images/logo.jpg"
          alt=""
          width="40"
          height="40"
          class="size-10 rounded-full ring-2 ring-surface shadow-card"
        />
        <span class="font-brand text-2xl font-semibold text-accent-hover" dir="ltr">
          Crafty Corner
        </span>
        <span class="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent">
          {{ 'admin.title' | transloco }}
        </span>

        <div class="ms-auto flex items-center gap-2">
          <a [href]="storeUrl" target="_blank" rel="noopener" class="btn !px-3 !py-2 text-sm">
            {{ 'admin.viewStore' | transloco }}
          </a>
          <button
            type="button"
            class="btn !px-3 !py-2 text-sm"
            [attr.lang]="language.lang() === 'ar' ? 'en' : 'ar'"
            (click)="language.toggle()"
          >
            <app-icon name="globe" [size]="1" />
            {{ 'lang.switchTo' | transloco }}
          </button>
          @if (auth.isAuthenticated()) {
            <button
              type="button"
              class="btn !px-2.5 !py-2.5"
              [attr.aria-label]="'auth.logout' | transloco"
              (click)="logout()"
            >
              <app-icon name="log-out" [size]="1.15" class="rtl:-scale-x-100" />
            </button>
          }
        </div>
      </div>
    </header>
    <app-toasts />
    <main class="min-h-[70vh] pb-10">
      <router-outlet />
    </main>
  `,
})
export class AdminApp {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  protected readonly storeUrl = environment.storeUrl;

  protected logout(): void {
    this.auth.logout().subscribe(() => void this.router.navigateByUrl('/login'));
  }
}
