import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { authErrorKey } from '@web/core/auth/auth-error';
import { AuthService } from '@web/core/auth/auth.service';
import { ApiError } from '@web/core/models/api.models';

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
  private readonly returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly submitting = signal(false);
  // جلسة عميل عادي (من الموقع) مفتوحة على نفس المتصفح: ننبّه إنه محتاج حساب الأدمن
  protected readonly error = signal<string | null>(
    this.auth.isAuthenticated() && !this.auth.isAdmin() ? 'admin.login.notOwner' : null,
  );

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('auth.validation.passwordRequired');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        if (user.role !== 'Admin') {
          this.submitting.set(false);
          this.auth.logout().subscribe(() => this.error.set('admin.login.notOwner'));
          return;
        }
        const url = this.returnUrl;
        void this.router.navigateByUrl(
          url && url.startsWith('/') && !url.startsWith('//') ? url : '/',
        );
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.error.set(authErrorKey(error));
      },
    });
  }
}
