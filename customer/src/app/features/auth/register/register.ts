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
import { authErrorKey } from '@shared/core/auth/auth-error';
import { safeReturnUrl } from '@shared/core/auth/auth.guard';
import { AuthService } from '@shared/core/auth/auth.service';
import { egyptPhoneValidator } from '@shared/core/forms/egypt-phone';
import { firstError } from '@shared/core/forms/form-errors';
import { ApiError } from '@shared/core/models/api.models';
import { Icon, IconName } from '@shared/ui/icon';

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
    <section class="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div
        class="grid overflow-hidden rounded-3xl border border-border bg-surface shadow-card md:grid-cols-[0.8fr_1.2fr]"
      >
        <aside
          class="relative hidden flex-col justify-between gap-10 overflow-hidden bg-ink p-9 text-white/85 md:flex"
        >
          <!-- decoration: soft light and an arch, like the product frames -->
          <span
            aria-hidden="true"
            class="pointer-events-none absolute -end-24 -top-24 size-72 rounded-full bg-accent/30 blur-3xl"
          ></span>
          <span
            aria-hidden="true"
            class="pointer-events-none absolute -bottom-28 -start-20 h-72 w-56 rounded-t-full border border-white/10"
          ></span>

          <div class="relative">
            <img
              src="images/logo.jpg"
              alt=""
              width="64"
              height="64"
              class="size-16 rounded-full ring-2 ring-white/20"
            />
            <h2 class="mt-6 font-display text-3xl font-bold leading-snug text-white">
              {{ 'auth.register.sideTitle' | transloco }}
            </h2>
          </div>

          <ul class="relative grid gap-6">
            @for (perk of perks; track perk.key) {
              <li class="flex items-start gap-3.5">
                <span
                  class="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-highlight"
                >
                  <app-icon [name]="perk.icon" [size]="1.15" />
                </span>
                <span class="pt-1.5 text-sm leading-relaxed">
                  {{ 'auth.register.' + perk.key | transloco }}
                </span>
              </li>
            }
          </ul>

          <p class="relative flex items-center gap-2 text-xs text-white/60">
            <app-icon name="shield" [size]="1" />
            {{ 'auth.register.privacy' | transloco }}
          </p>
        </aside>

        <div class="p-6 sm:p-10">
          <header class="mb-7">
            <img
              src="images/logo.jpg"
              alt=""
              width="48"
              height="48"
              class="mb-4 size-12 rounded-full ring-1 ring-border md:hidden"
            />
            <h1 class="text-3xl font-bold tracking-tight">
              {{ 'auth.register.title' | transloco }}
            </h1>
            <p class="mt-1 text-sm text-muted">{{ 'auth.register.subtitle' | transloco }}</p>
          </header>

          <form
            [formGroup]="form"
            (ngSubmit)="submit()"
            novalidate
            class="grid gap-x-4 gap-y-5 sm:grid-cols-2"
          >
            @if (serverError(); as key) {
              <p
                role="alert"
                class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger sm:col-span-2"
              >
                {{ key | transloco }}
              </p>
            }

            <div class="sm:col-span-2">
              <label for="reg-name" class="mb-1.5 block text-sm font-medium">
                {{ 'auth.fields.fullName' | transloco }}
              </label>
              <div class="relative">
                <app-icon
                  name="user"
                  [size]="1.05"
                  class="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  id="reg-name"
                  type="text"
                  formControlName="fullName"
                  autocomplete="name"
                  class="field !py-2.5 !ps-10"
                  [attr.aria-invalid]="nameError() ? 'true' : null"
                  [attr.aria-describedby]="nameError() ? 'reg-name-error' : null"
                />
              </div>
              @if (nameError(); as key) {
                <p id="reg-name-error" class="mt-1.5 text-sm text-danger">{{ key | transloco }}</p>
              }
            </div>

            <div>
              <label for="reg-email" class="mb-1.5 block text-sm font-medium">
                {{ 'auth.fields.email' | transloco }}
              </label>
              <div class="relative" dir="ltr">
                <app-icon
                  name="mail"
                  [size]="1.05"
                  class="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  id="reg-email"
                  type="email"
                  formControlName="email"
                  autocomplete="email"
                  inputmode="email"
                  class="field !py-2.5 !ps-10"
                  placeholder="name@example.com"
                  [attr.aria-invalid]="emailError() ? 'true' : null"
                  [attr.aria-describedby]="emailError() ? 'reg-email-error' : null"
                />
              </div>
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
              <div class="relative" dir="ltr">
                <app-icon
                  name="phone"
                  [size]="1.05"
                  class="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  id="reg-phone"
                  type="tel"
                  formControlName="phone"
                  autocomplete="tel"
                  inputmode="tel"
                  class="field !py-2.5 !ps-10"
                  placeholder="01012345678"
                  [attr.aria-invalid]="phoneError() ? 'true' : null"
                  [attr.aria-describedby]="phoneError() ? 'reg-phone-error' : 'reg-phone-hint'"
                />
              </div>
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
              @if (passwordError(); as key) {
                <p class="mt-1.5 text-sm text-danger">{{ key | transloco }}</p>
              }
            </div>

            <div>
              <label for="reg-confirm" class="mb-1.5 block text-sm font-medium">
                {{ 'auth.fields.confirmPassword' | transloco }}
              </label>
              <div class="relative" dir="ltr">
                <input
                  id="reg-confirm"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="confirmPassword"
                  autocomplete="new-password"
                  class="field !py-2.5 !pe-11"
                  [attr.aria-invalid]="confirmError() ? 'true' : null"
                  [attr.aria-describedby]="confirmError() ? 'reg-confirm-error' : null"
                />
                @if (passwordsMatch()) {
                  <span
                    class="absolute inset-y-0 end-0 grid w-11 place-items-center text-success"
                    aria-hidden="true"
                  >
                    <app-icon name="check" [size]="1.1" />
                  </span>
                }
              </div>
              @if (confirmError(); as key) {
                <p id="reg-confirm-error" class="mt-1.5 text-sm text-danger">
                  {{ key | transloco }}
                </p>
              }
            </div>

            <!-- how strong the password is, and which rules it still misses -->
            <div class="sm:col-span-2" id="reg-password-rules">
              <div class="flex items-center gap-3">
                <span class="flex flex-1 gap-1.5" aria-hidden="true">
                  @for (segment of [1, 2, 3, 4]; track segment) {
                    <span
                      class="h-1.5 flex-1 rounded-full transition-colors duration-300"
                      [class]="segment <= strength().score ? strength().color : 'bg-border'"
                    ></span>
                  }
                </span>
                <span class="w-16 text-end text-xs font-medium text-muted">
                  @if (strength().score > 0) {
                    {{ 'auth.register.strength.' + strength().label | transloco }}
                  }
                </span>
              </div>
              <ul class="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs">
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

            <div class="sm:col-span-2">
              <button
                type="submit"
                class="btn btn-accent w-full py-3 text-base"
                [disabled]="submitting()"
              >
                {{
                  (submitting() ? 'auth.register.submitting' : 'auth.register.submit') | transloco
                }}
              </button>
              <p class="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted md:hidden">
                <app-icon name="shield" [size]="0.95" />
                {{ 'auth.register.privacy' | transloco }}
              </p>
            </div>
          </form>

          <p class="mt-6 border-t border-border pt-5 text-center text-sm text-muted">
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

  private readonly confirmValue = toSignal(this.form.controls.confirmPassword.valueChanges, {
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

  /** 0 to 4 filled segments: length, letters and digits together, a long one, and a symbol or mixed case. */
  protected readonly strength = computed(() => {
    const value = this.passwordValue();
    if (!value) return { score: 0, label: 'weak', color: 'bg-border' };
    const score =
      Number(value.length >= 8) +
      Number(/[A-Za-z]/.test(value) && /\d/.test(value)) +
      Number(value.length >= 12) +
      Number(/[^A-Za-z0-9]/.test(value) || (/[a-z]/.test(value) && /[A-Z]/.test(value)));
    return [
      { score: 1, label: 'weak', color: 'bg-danger' },
      { score: 2, label: 'fair', color: 'bg-highlight' },
      { score: 3, label: 'good', color: 'bg-accent' },
      { score: 4, label: 'strong', color: 'bg-success' },
    ][Math.max(1, score) - 1];
  });

  /** The two passwords are the same (and not empty): shown as a tick in the second field. */
  protected readonly passwordsMatch = computed(
    () => this.confirmValue() !== '' && this.confirmValue() === this.passwordValue(),
  );

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
