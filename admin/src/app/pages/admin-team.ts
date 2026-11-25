import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { BehaviorSubject, Observable, switchMap } from 'rxjs';
import { initialOf } from '@shared/core/forms/form-errors';
import { ApiError } from '@shared/core/models/api.models';
import { LoadState, toLoadState } from '@shared/core/state/load-state';
import { ToastService } from '@shared/core/toast/toast.service';
import { DateTimePipe } from '@shared/pipes/date-time.pipe';
import { Icon } from '@shared/ui/icon';
import { AdminUser } from '../data/admin.models';
import { AdminService } from '../data/admin.service';

/** نفس قاعدة الـ API: حرف واحد ورقم واحد على الأقل، و8 أحرف. */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

type Panel = { id: number; kind: 'edit' | 'password' } | null;

/** فريق المتجر: إضافة أدمن جديد، تعديل اسم وإيميل أي أدمن، تغيير كلمة السر، وإيقاف أو تفعيل الحساب. */
@Component({
  selector: 'app-admin-team',
  imports: [ReactiveFormsModule, TranslocoPipe, DateTimePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-xl text-sm text-muted">{{ 'admin.team.intro' | transloco }}</p>
      <button type="button" class="btn btn-accent" (click)="toggleCreate()">
        <app-icon [name]="creating() ? 'x' : 'plus'" [size]="1" />
        {{ (creating() ? 'admin.team.cancel' : 'admin.team.add') | transloco }}
      </button>
    </div>

    @if (creating()) {
      <form
        [formGroup]="createForm"
        (ngSubmit)="create()"
        novalidate
        class="card mb-5 grid gap-4 p-5"
      >
        <h2 class="font-bold">{{ 'admin.team.add' | transloco }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="new-name" class="mb-1.5 block text-sm font-medium">
              {{ 'admin.team.name' | transloco }}
            </label>
            <input id="new-name" formControlName="fullName" class="field" autocomplete="off" />
          </div>
          <div>
            <label for="new-email" class="mb-1.5 block text-sm font-medium">
              {{ 'admin.team.email' | transloco }}
            </label>
            <input
              id="new-email"
              type="email"
              formControlName="email"
              class="field"
              dir="ltr"
              autocomplete="off"
            />
          </div>
        </div>
        <div>
          <label for="new-password" class="mb-1.5 block text-sm font-medium">
            {{ 'admin.team.password' | transloco }}
          </label>
          <input
            id="new-password"
            type="password"
            formControlName="password"
            class="field sm:max-w-sm"
            dir="ltr"
            autocomplete="new-password"
          />
          <p class="mt-1.5 text-xs text-muted">{{ 'admin.team.passwordHint' | transloco }}</p>
        </div>
        @if (formError(); as key) {
          <p role="alert" class="text-sm text-danger">{{ key | transloco }}</p>
        }
        <div>
          <button type="submit" class="btn btn-accent" [disabled]="busy()">
            {{ 'admin.team.create' | transloco }}
          </button>
        </div>
      </form>
    }

    @let current = state();
    @if (current.status === 'ready') {
      <ul class="card divide-y divide-border overflow-hidden">
        @for (user of current.data; track user.id) {
          <li class="p-4 sm:px-5" [class.opacity-60]="!user.isActive">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span
                class="grid size-11 shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-fg"
                aria-hidden="true"
                >{{ initial(user.fullName) }}</span
              >
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-center gap-2 font-semibold">
                  {{ user.fullName }}
                  @if (user.isCurrentUser) {
                    <span
                      class="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent"
                    >
                      {{ 'admin.team.you' | transloco }}
                    </span>
                  }
                  @if (!user.isActive) {
                    <span class="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold">
                      {{ 'admin.team.inactive' | transloco }}
                    </span>
                  }
                </p>
                <p class="truncate text-sm text-muted" dir="ltr">{{ user.email }}</p>
                <p class="text-xs text-muted">
                  {{ 'admin.team.since' | transloco }} {{ user.createdAt | dateTime }}
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn !py-1.5" (click)="open(user, 'edit')">
                  {{ 'admin.edit' | transloco }}
                </button>
                <button type="button" class="btn !py-1.5" (click)="open(user, 'password')">
                  {{ 'admin.team.password' | transloco }}
                </button>
                @if (!user.isCurrentUser) {
                  <button
                    type="button"
                    class="btn !py-1.5"
                    [class]="user.isActive ? '!border-danger !text-danger' : ''"
                    [disabled]="busy()"
                    (click)="toggleActive(user)"
                  >
                    {{
                      (user.isActive ? 'admin.team.deactivate' : 'admin.team.activate') | transloco
                    }}
                  </button>
                }
              </div>
            </div>

            @if (panel()?.id === user.id) {
              <div class="mt-4 rounded-xl bg-surface-2/50 p-4">
                @if (panel()?.kind === 'edit') {
                  <form
                    [formGroup]="editForm"
                    (ngSubmit)="saveEdit(user)"
                    novalidate
                    class="grid gap-4 sm:grid-cols-2"
                  >
                    <div>
                      <label [for]="'e-name-' + user.id" class="mb-1.5 block text-sm font-medium">
                        {{ 'admin.team.name' | transloco }}
                      </label>
                      <input [id]="'e-name-' + user.id" formControlName="fullName" class="field" />
                    </div>
                    <div>
                      <label [for]="'e-email-' + user.id" class="mb-1.5 block text-sm font-medium">
                        {{ 'admin.team.email' | transloco }}
                      </label>
                      <input
                        [id]="'e-email-' + user.id"
                        type="email"
                        formControlName="email"
                        class="field"
                        dir="ltr"
                      />
                    </div>
                    @if (formError(); as key) {
                      <p role="alert" class="text-sm text-danger sm:col-span-2">
                        {{ key | transloco }}
                      </p>
                    }
                    <div class="flex gap-2 sm:col-span-2">
                      <button type="submit" class="btn btn-accent" [disabled]="busy()">
                        {{ 'admin.save' | transloco }}
                      </button>
                      <button type="button" class="btn" (click)="panel.set(null)">
                        {{ 'admin.team.cancel' | transloco }}
                      </button>
                    </div>
                  </form>
                } @else {
                  <form
                    [formGroup]="passwordForm"
                    (ngSubmit)="savePassword(user)"
                    novalidate
                    class="grid gap-4 sm:grid-cols-2"
                  >
                    @if (user.isCurrentUser) {
                      <div>
                        <label [for]="'p-cur-' + user.id" class="mb-1.5 block text-sm font-medium">
                          {{ 'admin.team.currentPassword' | transloco }}
                        </label>
                        <input
                          [id]="'p-cur-' + user.id"
                          type="password"
                          formControlName="currentPassword"
                          class="field"
                          dir="ltr"
                          autocomplete="current-password"
                        />
                      </div>
                    }
                    <div>
                      <label [for]="'p-new-' + user.id" class="mb-1.5 block text-sm font-medium">
                        {{ 'admin.team.newPassword' | transloco }}
                      </label>
                      <input
                        [id]="'p-new-' + user.id"
                        type="password"
                        formControlName="newPassword"
                        class="field"
                        dir="ltr"
                        autocomplete="new-password"
                      />
                    </div>
                    <p class="text-xs text-muted sm:col-span-2">
                      {{ 'admin.team.passwordHint' | transloco }}
                      {{ 'admin.team.signOutNote' | transloco }}
                    </p>
                    @if (formError(); as key) {
                      <p role="alert" class="text-sm text-danger sm:col-span-2">
                        {{ key | transloco }}
                      </p>
                    }
                    <div class="flex gap-2 sm:col-span-2">
                      <button type="submit" class="btn btn-accent" [disabled]="busy()">
                        {{ 'admin.save' | transloco }}
                      </button>
                      <button type="button" class="btn" (click)="panel.set(null)">
                        {{ 'admin.team.cancel' | transloco }}
                      </button>
                    </div>
                  </form>
                }
              </div>
            }
          </li>
        }
      </ul>
    } @else if (current.status === 'loading') {
      <div class="card skeleton h-40" aria-hidden="true"></div>
    } @else {
      <p class="card p-6 text-danger" role="alert">{{ 'admin.loadError' | transloco }}</p>
    }
  `,
})
export class AdminTeam {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  protected readonly initial = initialOf;
  protected readonly creating = signal(false);
  protected readonly panel = signal<Panel>(null);
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly createForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: [
      '',
      [Validators.required, Validators.minLength(8), Validators.pattern(PASSWORD_PATTERN)],
    ],
  });
  protected readonly editForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });
  protected readonly passwordForm = this.fb.group({
    currentPassword: [''],
    newPassword: [
      '',
      [Validators.required, Validators.minLength(8), Validators.pattern(PASSWORD_PATTERN)],
    ],
  });

  protected readonly state = toSignal(
    this.reload$.pipe(switchMap(() => this.admin.adminUsers().pipe(toLoadState()))),
    { initialValue: { status: 'loading' } as LoadState<AdminUser[]> },
  );

  protected toggleCreate(): void {
    this.creating.update((value) => !value);
    this.panel.set(null);
    this.formError.set(null);
    this.createForm.reset();
  }

  protected open(user: AdminUser, kind: 'edit' | 'password'): void {
    const same = this.panel()?.id === user.id && this.panel()?.kind === kind;
    this.panel.set(same ? null : { id: user.id, kind });
    this.creating.set(false);
    this.formError.set(null);
    this.editForm.reset({ fullName: user.fullName, email: user.email });
    this.passwordForm.reset({ currentPassword: '', newPassword: '' });
  }

  protected create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.formError.set('admin.team.errors.invalid');
      return;
    }
    this.run(this.admin.createAdmin(this.createForm.getRawValue()), 'admin.team.created', () => {
      this.creating.set(false);
      this.createForm.reset();
    });
  }

  protected saveEdit(user: AdminUser): void {
    if (this.editForm.invalid) {
      this.formError.set('admin.team.errors.invalid');
      return;
    }
    this.run(this.admin.updateAdmin(user.id, this.editForm.getRawValue()), 'admin.team.saved', () =>
      this.panel.set(null),
    );
  }

  protected savePassword(user: AdminUser): void {
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    if (
      this.passwordForm.controls.newPassword.invalid ||
      (user.isCurrentUser && !currentPassword)
    ) {
      this.formError.set('admin.team.errors.invalidPassword');
      return;
    }
    this.run(
      this.admin.setAdminPassword(user.id, {
        newPassword,
        currentPassword: user.isCurrentUser ? currentPassword : undefined,
      }),
      'admin.team.passwordChanged',
      () => this.panel.set(null),
    );
  }

  protected toggleActive(user: AdminUser): void {
    this.run(
      this.admin.setAdminActive(user.id, !user.isActive),
      user.isActive ? 'admin.team.deactivated' : 'admin.team.activated',
    );
  }

  private run(request: Observable<unknown>, successKey: string, after?: () => void): void {
    this.busy.set(true);
    this.formError.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        after?.();
        this.toasts.show({ kind: 'success', key: successKey });
        this.reload$.next();
      },
      error: (error: ApiError) => {
        this.busy.set(false);
        const key = this.errorKey(error);
        // الخطأ جوه الفورم لو فيه فورم مفتوح، وإلا رسالة صغيرة
        if (this.creating() || this.panel()) this.formError.set(key);
        else this.toasts.show({ kind: 'error', key });
      },
    });
  }

  private errorKey(error: ApiError): string {
    switch (error.status) {
      case 409:
        return /last|remain|own/i.test(error.detail ?? '')
          ? 'admin.team.errors.lastAdmin'
          : 'admin.team.errors.emailTaken';
      case 400:
        return /current password/i.test(error.detail ?? '')
          ? 'admin.team.errors.wrongPassword'
          : 'admin.team.errors.invalid';
      default:
        return 'admin.saveFailed';
    }
  }
}
