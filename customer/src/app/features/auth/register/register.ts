import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { authErrorKey } from '../../../core/auth/auth-error';
import { safeReturnUrl } from '../../../core/auth/auth.guard';
import { AuthService } from '../../../core/auth/auth.service';
import { egyptPhoneValidator } from '../../../core/forms/egypt-phone';
import { firstError } from '../../../core/forms/form-errors';
import { ApiError } from '../../../core/models/api.models';
import { Icon, IconName } from '../../../shared/ui/icon';

/** نفس قاعدة الـ API: حرف واحد على الأقل ورقم واحد على الأقل. */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl px-4 py-10">
      <div
        class="grid overflow-hidden rounded-3xl border border-border bg-surface shadow-card md:grid-cols-[0.9fr_1.1fr]"
      >
        <aside
          class="relative hidden flex-col justify-center gap-10 bg-ink p-8 text-white/85 md:flex"
        >
          <div>
            <img
              src="images/logo.jpg"
              alt=""
              width="56"
              height="56"
              class="size-14 rounded-full ring-2 ring-white/20"
            />
            <h2 class="mt-5 text-2xl font-bold text-white">
              {{ 'auth.register.sideTitle' | transloco }}
            </h2>
          </div>
          <ul class="grid gap-5">
            @for (perk of perks; track perk.key) {
              <li class="flex items-start gap-3">
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-highlight"
                >
                  <app-icon [name]="perk.icon" [size]="1.1" />
                </span>
                <span class="pt-1 text-sm leading-relaxed">
                  {{ 'auth.register.' + perk.key | transloco }}
                </span>
              </li>
            }
          </ul>
        </aside>

        <div class="p-6 sm:p-9">
          <header class="mb-6">
            <h1 class="text-3xl font-bold tracking-tight">
              {{ 'auth.register.title' | transloco }}
            </h1>
            <p class="mt-1 text-sm text-muted">{{ 'auth.register.subtitle' | transloco }}</p>
          </header>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="grid gap-4">
            @if (serverError(); as key) {
              <p
                role="alert"
                class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {{ key | transloco }}
              </p>
            }

            <div>
              <label for="reg-name" class="mb-1.5 block text-sm font-medium">
                {{ 'auth.fields.fullName' | transloco }}
              </label>
              <input
                id="reg-name"
                type="text"
                formControlName="fullName"
                autocomplete="name"
                class="field !py-2.5"
                [attr.aria-invalid]="nameError() ? 'true' : null"
                [attr.aria-describedby]="nameError() ? 'reg-name-error' : null"
              />
              @if (nameError(); as key) {
                <p id="reg-name-error" class="mt-1.5 text-sm text-danger">{{ key | transloco }}</p>
              }
            </div>

            <div>
              <label for="reg-email" class="mb-1.5 block text-sm font-medium">
                {{ 'auth.fields.email' | transloco }}
              </label>
              <input
                id="reg-email"
                type="email"
                formControlName="email"
                autocomplete="email"
                inputmode="email"
                dir="ltr"
                class="field !py-2.5"
                placeholder="name@example.com"
                [attr.aria-invalid]="emailError() ? 'true' : null"
                [attr.aria-describedby]="emailError() ? 'reg-email-error' : null"
              />
              @if (emailError(); as key) {
                <p id="reg-email-error" class="mt-1.5 text-sm text-danger">
                  {{ key | transloco }}
                </p>
              }
            </div>

            <div>
              <label for="reg-phone" class="mb-1.5 block text-sm font-medium">
                {{ 'auth.fields.phone' | transloco }}
              </label>
              <input
                id="reg-phone"
                type="tel"
                formControlName="phone"
                autocomplete="tel"
                inputmode="tel"
                dir="ltr"
                class="field !py-2.5"
                placeholder="01012345678"
                [attr.aria-invalid]="phoneError() ? 'true' : null"
                [attr.aria-describedby]="phoneError() ? 'reg-phone-error' : 'reg-phone-hint'"
              />
              @if (phoneError(); as key) {
                <p id="reg-phone-error" class="mt-1.5 text-sm text-danger">
                  {{ key | transloco }}
                </p>
              } @else {
                <p id="reg-phone-hint" class="mt-1.5 text-xs text-muted">
                  {{ 'auth.register.phoneHint' | transloco }}
                </p>
              }
            </div>

            <div>
              <label for="reg-password" class="mb-1.5 block text-sm font-medium">
                {{ 'auth.fields.password' | transloco }}
              </label>
              <!-- dir=ltr على الغلاف كمان: عشان زرار العين يفضل على اليمين وما يغطيش على النص -->
              <div class="relative" dir="ltr">
                <input
                  id="reg-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="new-password"
                  class="field !py-2.5 !pe-11"
                  [attr.aria-invalid]="passwordError() ? 'true' : null"
                  aria-describedby="reg-password-rules"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 end-0 grid w-11 place-items-center text-muted transition hover:text-fg"
                  [attr.aria-label]="
                    (showPassword() ? 'auth.fields.hidePassword' : 'auth.fields.showPassword')
                      | transloco
                  "
                  [attr.aria-pressed]="showPassword()"
                  (click)="showPassword.set(!showPassword())"
                >
                  <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="1.1" />
                </button>
              </div>
              <ul id="reg-password-rules" class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                @for (rule of rules(); track rule.key) {
                  <li
                    class="flex items-center gap-1.5 transition-colors"
                    [class]="rule.ok ? 'text-success' : 'text-muted'"
                  >
                    <app-icon [name]="rule.ok ? 'check' : 'minus'" [size]="0.9" />
                    {{ 'auth.register.' + rule.key | transloco }}
                  </li>
                }
              </ul>
            </div>

            <div>
              <label for="reg-confirm" class="mb-1.5 block text-sm font-medium">
                {{ 'auth.fields.confirmPassword' | transloco }}
              </label>
              <input
                id="reg-confirm"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="confirmPassword"
                autocomplete="new-password"
                dir="ltr"
                class="field !py-2.5"
                [attr.aria-invalid]="confirmError() ? 'true' : null"
                [attr.aria-describedby]="confirmError() ? 'reg-confirm-error' : null"
              />
              @if (confirmError(); as key) {
                <p id="reg-confirm-error" class="mt-1.5 text-sm text-danger">
                  {{ key | transloco }}
                </p>
              }
            </div>

            <button
              type="submit"
              class="btn btn-accent mt-1 w-full py-3 text-base"
              [disabled]="submitting()"
            >
              {{ (submitting() ? 'auth.register.submitting' : 'auth.register.submit') | transloco }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-muted">
            {{ 'auth.register.haveAccount' | transloco }}
            <a
              routerLink="/login"
              [queryParams]="returnUrlParam()"
              class="font-semibold text-accent hover:underline"
            >
              {{ 'auth.register.signIn' | transloco }}
            </a>
          </p>
        </div>
      </div>
    </section>
  `,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      phone: ['', [Validators.required, egyptPhoneValidator]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(100),
          Validators.pattern(PASSWORD_PATTERN),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected readonly perks: { key: string; icon: IconName }[] = [
    { key: 'perk1', icon: 'clock' },
    { key: 'perk2', icon: 'pin' },
    { key: 'perk3', icon: 'cash' },
  ];

  private readonly passwordValue = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  /** شروط كلمة السر: بتتأكد وإنت بتكتب. */
  protected readonly rules = computed(() => {
    const value = this.passwordValue();
    return [
      { key: 'ruleLength', ok: value.length >= 8 },
      { key: 'ruleLetter', ok: /[A-Za-z]/.test(value) },
      { key: 'ruleNumber', ok: /\d/.test(value) },
    ];
  });

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  private readonly submitted = signal(false);

  private readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  protected returnUrlParam() {
    return this.returnUrl ? { returnUrl: this.returnUrl } : {};
  }

  protected nameError(): string | null {
    const control = this.form.controls.fullName;
    return firstError(
      control,
      { required: 'auth.validation.nameRequired', minlength: 'auth.validation.nameShort' },
      control.touched || this.submitted(),
    );
  }

  protected emailError(): string | null {
    const control = this.form.controls.email;
    return firstError(
      control,
      { required: 'auth.validation.emailRequired', email: 'auth.validation.emailInvalid' },
      control.touched || this.submitted(),
    );
  }

  protected phoneError(): string | null {
    const control = this.form.controls.phone;
    return firstError(
      control,
      { required: 'auth.validation.phoneRequired', pattern: 'auth.validation.phoneInvalid' },
      control.touched || this.submitted(),
    );
  }

  protected passwordError(): string | null {
    const control = this.form.controls.password;
    return firstError(
      control,
      {
        required: 'auth.validation.passwordRequired',
        minlength: 'auth.validation.passwordShort',
        pattern: 'auth.validation.passwordWeak',
      },
      control.touched || this.submitted(),
    );
  }

  protected confirmError(): string | null {
    const control = this.form.controls.confirmPassword;
    const show = control.touched || this.submitted();
    if (!show) return null;
    if (control.hasError('required')) return 'auth.validation.confirmRequired';
    return this.form.hasError('mismatch') ? 'auth.validation.mismatch' : null;
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.serverError.set(null);

    const { fullName, email, phone, password } = this.form.getRawValue();
    this.auth.register({ fullName, email, phone, password }).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl)),
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.serverError.set(authErrorKey(error));
      },
    });
  }
}
