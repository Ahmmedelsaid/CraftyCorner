import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { AuthService } from '@shared/core/auth/auth.service';
import { egyptPhoneValidator } from '@shared/core/forms/egypt-phone';
import { firstError, initialOf } from '@shared/core/forms/form-errors';
import { GOVERNORATES } from '../../core/geo/governorates';
import { LanguageService } from '@shared/core/i18n/language.service';
import { OrderSummary } from '@shared/core/orders/order.models';
import { OrdersService } from '../../core/orders/orders.service';
import { ToastService } from '@shared/core/toast/toast.service';
import { DateTimePipe } from '@shared/pipes/date-time.pipe';
import { PricePipe } from '@shared/pipes/price.pipe';
import { Icon } from '@shared/ui/icon';
import { OrderStatusBadge } from '@shared/ui/order-status';
import { Reveal } from '../../shared/directives/reveal';

/** صفحة العميل: بياناته (الاسم والموبايل)، عنوان التوصيل الافتراضي، وآخر طلباته. */
@Component({
  selector: 'app-account',
  imports: [
    Reveal,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    PricePipe,
    DateTimePipe,
    Icon,
    OrderStatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.user(); as user) {
      <section class="mx-auto grid max-w-5xl gap-6 px-4 py-10">
        <header
          class="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6"
        >
          <div
            class="grid size-16 shrink-0 place-items-center rounded-full bg-accent text-2xl font-bold text-accent-fg"
            aria-hidden="true"
          >
            {{ initial() }}
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="truncate text-2xl font-bold tracking-tight">
              {{ 'account.greeting' | transloco: { name: firstName() } }}
            </h1>
            <p class="truncate text-sm text-muted" dir="ltr">{{ user.email }}</p>
          </div>
          <button type="button" class="btn" (click)="logout()">
            <app-icon name="log-out" [size]="1.1" class="rtl:-scale-x-100" />
            {{ 'account.signOut' | transloco }}
          </button>
        </header>

        @if (incomplete()) {
          <div
            role="status"
            class="flex items-start gap-3 rounded-2xl border border-highlight/60 bg-accent-soft p-4"
          >
            <app-icon name="pin" [size]="1.3" class="mt-0.5 text-accent" />
            <div>
              <h2 class="font-semibold">{{ 'account.incompleteTitle' | transloco }}</h2>
              <p class="text-sm text-muted">{{ 'account.incompleteText' | transloco }}</p>
            </div>
          </div>
        }

        <div class="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <form
            [formGroup]="form"
            (ngSubmit)="save()"
            novalidate
            class="grid gap-5"
            [attr.aria-label]="'account.profile' | transloco"
          >
            <section
              appReveal
              class="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6"
            >
              <h2 class="flex items-center gap-2 font-semibold">
                <app-icon name="user" [size]="1.1" class="text-accent" />
                {{ 'account.profile' | transloco }}
              </h2>

              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label for="acc-name" class="mb-1.5 block text-sm font-medium">
                    {{ 'account.name' | transloco }}
                  </label>
                  <input
                    id="acc-name"
                    formControlName="fullName"
                    autocomplete="name"
                    class="field"
                    [attr.aria-invalid]="nameError() ? 'true' : null"
                  />
                  @if (nameError(); as key) {
                    <p class="mt-1.5 text-sm text-danger">{{ key | transloco }}</p>
                  }
                </div>

                <div>
                  <label for="acc-phone" class="mb-1.5 block text-sm font-medium">
                    {{ 'account.phone' | transloco }}
                  </label>
                  <input
                    id="acc-phone"
                    type="tel"
                    formControlName="phone"
                    autocomplete="tel"
                    inputmode="tel"
                    dir="ltr"
                    class="field"
                    placeholder="01012345678"
                    [attr.aria-invalid]="phoneError() ? 'true' : null"
                  />
                  @if (phoneError(); as key) {
                    <p class="mt-1.5 text-sm text-danger">{{ key | transloco }}</p>
                  } @else {
                    <p class="mt-1.5 text-xs text-muted">{{ 'account.phoneHint' | transloco }}</p>
                  }
                </div>
              </div>

              <div>
                <label for="acc-email" class="mb-1.5 block text-sm font-medium">
                  {{ 'account.email' | transloco }}
                </label>
                <input
                  id="acc-email"
                  class="field cursor-not-allowed opacity-70"
                  dir="ltr"
                  readonly
                  [value]="user.email"
                />
              </div>
            </section>

            <section
              [appReveal]="100"
              class="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6"
            >
              <div>
                <h2 class="flex items-center gap-2 font-semibold">
                  <app-icon name="pin" [size]="1.1" class="text-accent" />
                  {{ 'account.addressTitle' | transloco }}
                </h2>
                <p class="mt-1 text-sm text-muted">{{ 'account.addressHint' | transloco }}</p>
              </div>

              <div>
                <label for="acc-city" class="mb-1.5 block text-sm font-medium">
                  {{ 'checkout.fields.city' | transloco }}
                </label>
                <select
                  id="acc-city"
                  formControlName="city"
                  autocomplete="address-level1"
                  class="field sm:max-w-xs"
                >
                  <option value="">{{ 'checkout.fields.cityPlaceholder' | transloco }}</option>
                  @for (governorate of governorates; track governorate.value) {
                    <option [value]="governorate.value">
                      {{ lang() === 'ar' ? governorate.ar : governorate.value }}
                    </option>
                  }
                </select>
              </div>

              <div>
                <label for="acc-address" class="mb-1.5 block text-sm font-medium">
                  {{ 'checkout.fields.address' | transloco }}
                </label>
                <textarea
                  id="acc-address"
                  formControlName="address"
                  rows="3"
                  autocomplete="street-address"
                  class="field resize-y"
                ></textarea>
              </div>

              @if (addressError(); as key) {
                <p role="alert" class="text-sm text-danger">{{ key | transloco }}</p>
              }
            </section>

            @if (serverError()) {
              <p
                role="alert"
                class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {{ 'errors.server' | transloco }}
              </p>
            }

            <div class="flex items-center gap-3">
              <button
                type="submit"
                class="btn btn-accent px-6 py-2.5"
                [disabled]="saving() || form.pristine"
              >
                {{ (saving() ? 'account.saving' : 'account.save') | transloco }}
              </button>
              @if (saved() && form.pristine) {
                <span class="flex items-center gap-1.5 text-sm font-medium text-success">
                  <app-icon name="check" [size]="1" />
                  {{ 'account.saved' | transloco }}
                </span>
              }
            </div>
          </form>

          <aside [appReveal]="200" class="grid gap-4">
            <section
              class="grid content-start gap-3 rounded-2xl border border-border bg-surface p-5"
            >
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold">{{ 'account.orders' | transloco }}</h2>
                @if (recentOrders().length) {
                  <a routerLink="/orders" class="text-sm font-medium text-accent hover:underline">
                    {{ 'orders.all' | transloco }}
                  </a>
                }
              </div>

              @if (recentOrders().length) {
                <ul class="grid gap-2">
                  @for (order of recentOrders(); track order.id) {
                    <li>
                      <a
                        [routerLink]="['/orders', order.id]"
                        class="grid gap-1 rounded-xl border border-border bg-bg/40 px-3 py-2.5 text-sm transition hover:border-accent/50"
                      >
                        <span class="flex flex-wrap items-center justify-between gap-2">
                          <span class="font-semibold">
                            {{ 'orders.number' | transloco: { id: order.id } }}
                          </span>
                          <app-order-status [status]="order.status" />
                        </span>
                        <span class="flex items-center justify-between text-xs text-muted">
                          <span>{{ order.createdAt | dateTime }}</span>
                          <span class="text-sm font-bold text-fg">{{ order.total | price }}</span>
                        </span>
                      </a>
                    </li>
                  }
                </ul>
              } @else {
                <div class="grid justify-items-center gap-2 py-4 text-center">
                  <app-icon name="box" [size]="2.2" class="text-muted/50" />
                  <p class="text-sm text-muted">{{ 'account.noOrders' | transloco }}</p>
                  <a routerLink="/products" class="btn btn-accent mt-1">
                    {{ 'account.startShopping' | transloco }}
                  </a>
                </div>
              }
            </section>
          </aside>
        </div>
      </section>
    }
  `,
})
export class Account {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  protected readonly lang = inject(LanguageService).lang;
  protected readonly governorates = GOVERNORATES;

  private readonly orders = toSignal(
    inject(OrdersService)
      .list()
      .pipe(catchError(() => of<OrderSummary[]>([]))),
    { initialValue: [] as OrderSummary[] },
  );

  /** آخر 3 طلبات (الباقي في صفحة "طلباتي"). */
  protected readonly recentOrders = computed(() => this.orders().slice(0, 3));

  protected readonly initial = computed(() => initialOf(this.auth.user()?.fullName));
  protected readonly firstName = computed(
    () => this.auth.user()?.fullName.trim().split(/\s+/)[0] ?? '',
  );

  /** ناقص موبايل أو عنوان افتراضي: نفكّره يكمّل بياناته. */
  protected readonly incomplete = computed(() => {
    const user = this.auth.user();
    return !!user && (!user.phone || !user.address || !user.city);
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: [
      this.auth.user()?.fullName ?? '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    ],
    phone: [this.auth.user()?.phone ?? '', [Validators.required, egyptPhoneValidator]],
    city: [this.auth.user()?.city ?? ''],
    address: [this.auth.user()?.address ?? '', [Validators.maxLength(300)]],
  });

  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly serverError = signal(false);
  private readonly submitted = signal(false);

  protected nameError(): string | null {
    const control = this.form.controls.fullName;
    return firstError(
      control,
      { required: 'checkout.validation.nameRequired', minlength: 'checkout.validation.nameShort' },
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

  /** العنوان والمحافظة مع بعض أو الاتنين فاضيين. */
  protected addressError(): string | null {
    if (!this.submitted()) return null;
    const { address, city } = this.form.getRawValue();
    const hasAddress = address.trim() !== '';
    const hasCity = city !== '';
    if (hasAddress !== hasCity) return 'account.addressBoth';
    return hasAddress && address.trim().length < 5 ? 'checkout.validation.addressShort' : null;
  }

  protected save(): void {
    this.submitted.set(true);
    this.saved.set(false);
    if (this.form.invalid || this.addressError()) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, phone, address, city } = this.form.getRawValue();
    this.saving.set(true);
    this.serverError.set(false);

    this.auth
      .updateProfile({
        fullName: fullName.trim(),
        phone,
        address: address.trim() || null,
        city: city || null,
      })
      .subscribe({
        next: (user) => {
          // الرقم بيرجع بالشكل الموحّد (01XXXXXXXXX)
          this.form.reset(
            {
              fullName: user.fullName,
              phone: user.phone ?? '',
              city: user.city ?? '',
              address: user.address ?? '',
            },
            { emitEvent: false },
          );
          this.saving.set(false);
          this.saved.set(true);
          this.submitted.set(false);
          this.toasts.show({ kind: 'success', key: 'account.saved' });
        },
        error: () => {
          this.saving.set(false);
          this.serverError.set(true);
        },
      });
  }

  protected logout(): void {
    this.auth.logout().subscribe(() => void this.router.navigateByUrl('/'));
  }
}
