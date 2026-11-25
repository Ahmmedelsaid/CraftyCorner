import { DOCUMENT } from '@angular/common';
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
import { WishlistService } from '../../core/wishlist/wishlist.service';
import { ToastService } from '@shared/core/toast/toast.service';
import { DateTimePipe } from '@shared/pipes/date-time.pipe';
import { PricePipe } from '@shared/pipes/price.pipe';
import { Icon, IconName } from '@shared/ui/icon';
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
      <section class="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:py-10">
        <!-- who you are, and how complete the profile is -->
        <header class="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
          <div
            class="flex flex-wrap items-center gap-4 bg-linear-to-br from-accent-soft/70 to-surface p-5 sm:p-6"
          >
            <div
              class="grid size-16 shrink-0 place-items-center rounded-full bg-accent text-2xl font-bold text-accent-fg shadow-lift ring-4 ring-surface"
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
          </div>

          <div class="grid gap-3 border-t border-border px-5 py-4 sm:px-6">
            <div class="flex items-center gap-3">
              <span
                class="h-2 flex-1 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-valuenow]="completion().percent"
                [attr.aria-label]="
                  'account.completeness' | transloco: { percent: completion().percent }
                "
              >
                <span
                  class="block h-full rounded-full transition-all duration-500"
                  [class]="completion().percent === 100 ? 'bg-success' : 'bg-accent'"
                  [style.width.%]="completion().percent"
                ></span>
              </span>
              <span class="text-sm font-semibold tabular-nums">
                {{ 'account.completeness' | transloco: { percent: completion().percent } }}
              </span>
            </div>

            <ul class="flex flex-wrap gap-2">
              @for (step of completion().steps; track step.key) {
                <li>
                  @if (step.done) {
                    <span
                      class="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success"
                    >
                      <app-icon name="check" [size]="0.9" />
                      {{ 'account.checklist.' + step.key | transloco }}
                    </span>
                  } @else {
                    <button
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-accent/60 bg-accent-soft px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent hover:text-accent-fg"
                      (click)="focus(step.target)"
                    >
                      <app-icon name="plus" [size]="0.9" />
                      {{ 'account.checklist.' + step.key | transloco }}
                    </button>
                  }
                </li>
              }
            </ul>

            @if (missing(); as what) {
              <p role="status" class="text-sm text-muted">
                {{ 'account.incomplete.' + what | transloco }}
              </p>
            } @else {
              <p role="status" class="text-sm text-success">
                {{ 'account.completeDone' | transloco }}
              </p>
            }
          </div>
        </header>

        <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <form
            [formGroup]="form"
            (ngSubmit)="save()"
            novalidate
            class="grid gap-5"
            [attr.aria-label]="'account.profile' | transloco"
          >
            <section
              appReveal
              class="grid gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6"
            >
              <h2 class="flex items-center gap-2 text-lg font-bold">
                <span
                  class="grid size-8 place-items-center rounded-full bg-accent-soft text-accent"
                >
                  <app-icon name="user" [size]="1.05" />
                </span>
                {{ 'account.profile' | transloco }}
              </h2>

              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label for="acc-name" class="mb-1.5 block text-sm font-medium">
                    {{ 'account.name' | transloco }}
                  </label>
                  <div class="relative">
                    <app-icon
                      name="user"
                      [size]="1.05"
                      class="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      id="acc-name"
                      formControlName="fullName"
                      autocomplete="name"
                      class="field !py-2.5 !ps-10"
                      [attr.aria-invalid]="nameError() ? 'true' : null"
                    />
                  </div>
                  @if (nameError(); as key) {
                    <p class="mt-1.5 text-sm text-danger">{{ key | transloco }}</p>
                  }
                </div>

                <div>
                  <label for="acc-phone" class="mb-1.5 block text-sm font-medium">
                    {{ 'account.phone' | transloco }}
                  </label>
                  <div class="relative" dir="ltr">
                    <app-icon
                      name="phone"
                      [size]="1.05"
                      class="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      id="acc-phone"
                      type="tel"
                      formControlName="phone"
                      autocomplete="tel"
                      inputmode="tel"
                      class="field !py-2.5 !ps-10"
                      placeholder="01012345678"
                      [attr.aria-invalid]="phoneError() ? 'true' : null"
                    />
                  </div>
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
                <div class="relative" dir="ltr">
                  <app-icon
                    name="mail"
                    [size]="1.05"
                    class="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    id="acc-email"
                    class="field cursor-not-allowed bg-surface-2/60 !py-2.5 !ps-10 text-muted"
                    readonly
                    [value]="user.email"
                  />
                </div>
                <p class="mt-1.5 text-xs text-muted">{{ 'account.emailLocked' | transloco }}</p>
              </div>
            </section>

            <section
              id="acc-address-section"
              [appReveal]="100"
              class="grid gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6"
            >
              <div>
                <h2 class="flex items-center gap-2 text-lg font-bold">
                  <span
                    class="grid size-8 place-items-center rounded-full bg-accent-soft text-accent"
                  >
                    <app-icon name="pin" [size]="1.05" />
                  </span>
                  {{ 'account.addressTitle' | transloco }}
                </h2>
                <p class="mt-1.5 text-sm text-muted">{{ 'account.addressHint' | transloco }}</p>
              </div>

              <div class="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
                <div>
                  <label for="acc-city" class="mb-1.5 block text-sm font-medium">
                    {{ 'checkout.fields.city' | transloco }}
                  </label>
                  <select
                    id="acc-city"
                    formControlName="city"
                    autocomplete="address-level1"
                    class="field !py-2.5"
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

            <!-- appears only when something was changed, and stays in reach while scrolling -->
            @if (!form.pristine) {
              <div
                class="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-surface/95 p-3 shadow-lift backdrop-blur"
              >
                <p class="flex items-center gap-2 ps-1 text-sm font-medium">
                  <span class="size-2 rounded-full bg-highlight"></span>
                  {{ 'account.unsaved' | transloco }}
                </p>
                <div class="flex gap-2">
                  <button type="button" class="btn" [disabled]="saving()" (click)="discard()">
                    {{ 'account.discard' | transloco }}
                  </button>
                  <button type="submit" class="btn btn-accent px-6" [disabled]="saving()">
                    {{ (saving() ? 'account.saving' : 'account.save') | transloco }}
                  </button>
                </div>
              </div>
            } @else if (saved()) {
              <p class="flex items-center gap-1.5 text-sm font-medium text-success">
                <app-icon name="check" [size]="1" />
                {{ 'account.saved' | transloco }}
              </p>
            }
          </form>

          <aside [appReveal]="200" class="grid gap-5 lg:sticky lg:top-24">
            <section
              class="grid content-start gap-3 rounded-2xl border border-border bg-surface p-5"
            >
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-lg font-bold">{{ 'account.orders' | transloco }}</h2>
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
                        class="grid gap-1 rounded-xl border border-border bg-bg/40 px-3 py-2.5 text-sm transition hover:-translate-y-0.5 hover:border-accent/50"
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

            <section class="rounded-2xl border border-border bg-surface p-2">
              <h2 class="px-3 pb-1 pt-3 text-sm font-bold text-muted">
                {{ 'account.quick.title' | transloco }}
              </h2>
              <ul>
                @for (link of quickLinks; track link.path) {
                  <li>
                    <a
                      [routerLink]="link.path"
                      class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-accent-soft"
                    >
                      <app-icon [name]="link.icon" [size]="1.1" class="text-accent" />
                      <span class="flex-1">{{ 'account.quick.' + link.key | transloco }}</span>
                      @if (link.key === 'favourites' && wishlist.count() > 0) {
                        <span
                          class="rounded-full bg-accent-soft px-2 text-xs font-bold tabular-nums text-accent"
                        >
                          {{ wishlist.count() }}
                        </span>
                      }
                      <app-icon
                        name="chevron-right"
                        [size]="0.95"
                        class="text-muted rtl:rotate-180"
                      />
                    </a>
                  </li>
                }
              </ul>
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
  private readonly document = inject(DOCUMENT);
  protected readonly wishlist = inject(WishlistService);
  protected readonly lang = inject(LanguageService).lang;
  protected readonly governorates = GOVERNORATES;

  protected readonly quickLinks: { key: string; path: string; icon: IconName }[] = [
    { key: 'orders', path: '/orders', icon: 'box' },
    { key: 'favourites', path: '/wishlist', icon: 'heart' },
    { key: 'contact', path: '/contact', icon: 'mail' },
  ];

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
  protected readonly missing = computed<'both' | 'phone' | 'address' | null>(() => {
    const user = this.auth.user();
    if (!user) return null;
    const noPhone = !user.phone;
    const noAddress = !user.address || !user.city;
    if (noPhone && noAddress) return 'both';
    if (noPhone) return 'phone';
    return noAddress ? 'address' : null;
  });

  /** The saved profile, step by step: a bar and a chip for each thing that is still missing. */
  protected readonly completion = computed(() => {
    const user = this.auth.user();
    const steps = [
      { key: 'name', done: !!user?.fullName?.trim(), target: 'acc-name' },
      { key: 'phone', done: !!user?.phone, target: 'acc-phone' },
      { key: 'address', done: !!user?.address && !!user?.city, target: 'acc-city' },
    ];
    const done = steps.filter((step) => step.done).length;
    return { steps, percent: Math.round((done / steps.length) * 100) };
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

  /** Takes the customer to the field a chip is about. */
  protected focus(id: string): void {
    const element = this.document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.focus({ preventScroll: true });
  }

  /** Puts the saved values back in the form. */
  protected discard(): void {
    const user = this.auth.user();
    this.form.reset({
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
      city: user?.city ?? '',
      address: user?.address ?? '',
    });
    this.submitted.set(false);
    this.serverError.set(false);
  }

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
