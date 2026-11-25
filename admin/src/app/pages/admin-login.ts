import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { authErrorKey } from '@shared/core/auth/auth-error';
import { AuthService } from '@shared/core/auth/auth.service';
import { ApiError } from '@shared/core/models/api.models';

/** دخول صاحبة المتجر. لو الحساب مش أدمن بنخرّجه ونقول السبب. */
@Component({
  selector: 'admin-login',
  imports: [ReactiveFormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto grid max-w-md gap-6 px-4 py-12">
      <header class="text-center">
        <h1 class="text-3xl">{{ 'admin.login.title' | transloco }}</h1>
        <p class="mt-1 text-muted">{{ 'admin.login.subtitle' | transloco }}</p>
      </header>

      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        novalidate
        class="grid gap-4 rounded-2xl border border-border bg-surface/60 p-6"
      >
        @if (error(); as key) {
          <p
            role="alert"
            class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {{ key | transloco }}
          </p>
        }
        <div>
          <label for="admin-email" class="mb-1.5 block text-sm font-medium">
            {{ 'auth.fields.email' | transloco }}
          </label>
          <input
            id="admin-email"
            type="email"
            formControlName="email"
            autocomplete="email"
            dir="ltr"
            class="field"
          />
        </div>
        <div>
          <label for="admin-password" class="mb-1.5 block text-sm font-medium">
            {{ 'auth.fields.password' | transloco }}
          </label>
          <input
            id="admin-password"
            type="password"
            formControlName="password"
            autocomplete="current-password"
            dir="ltr"
            class="field"
          />
        </div>
        <button type="submit" class="btn btn-accent mt-1 w-full py-2.5" [disabled]="submitting()">
          {{ (submitting() ? 'auth.login.submitting' : 'auth.login.submit') | transloco }}
        </button>
      </form>
    </section>
  `,
})
export class AdminLogin {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly submitting = signal(false);
  // جلسة عميل عادي (من الموقع) مفتوحة على نفس المتصفح: ننبّه إنه محتاج حساب الأدمن
  private readonly failure = signal<string | null>(
    this.auth.isAuthenticated() && !this.auth.isAdmin() ? 'admin.login.notOwner' : null,
  );
  // Signing out a customer switches the app from the dashboard frame back to the bare login page. The router
  // reuses this page for the "?error=notOwner" address, so the reason is read from the address as it changes.
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly dismissed = signal(false);
  protected readonly error = computed(
    () =>
      this.failure() ??
      (!this.dismissed() && this.query().get('error') === 'notOwner'
        ? 'admin.login.notOwner'
        : null),
  );

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.failure.set('auth.validation.passwordRequired');
      return;
    }
    this.submitting.set(true);
    this.failure.set(null);
    this.dismissed.set(true);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        if (user.role !== 'Admin') {
          this.submitting.set(false);
          // signing out switches the app from the dashboard frame back to the bare login page, which builds
          // this component again and would lose the message: so the reason travels in the address
          this.auth.logout().subscribe(() => {
            this.failure.set('admin.login.notOwner');
            void this.router.navigate(['/login'], { queryParams: { error: 'notOwner' } });
          });
          return;
        }
        const url = this.returnUrl;
        void this.router.navigateByUrl(
          url && url.startsWith('/') && !url.startsWith('//') ? url : '/',
        );
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.failure.set(authErrorKey(error));
      },
    });
  }
}
