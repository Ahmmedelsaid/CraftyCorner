import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { BehaviorSubject, switchMap } from 'rxjs';
import { LoadState, toLoadState } from '@shared/core/state/load-state';
import { ToastService } from '@shared/core/toast/toast.service';
import { AdminCategory } from '../data/admin.models';
import { AdminService } from '../data/admin.service';

/** تسمية التصنيفات بالعربي والإنجليزي: الإنجليزي بيظهر في الموقع لما الزائر يغيّر اللغة. */
@Component({
  selector: 'app-admin-categories',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="mb-5 max-w-xl text-sm text-muted">{{ 'admin.categories.intro' | transloco }}</p>

    @switch (state().status) {
      @case ('loading') {
        <div class="card skeleton h-40"></div>
      }
      @case ('error') {
        <p class="card p-6 text-danger" role="alert">{{ 'admin.loadError' | transloco }}</p>
      }
      @case ('ready') {
        <div class="card divide-y divide-border">
          @for (category of categories(); track category.id) {
            <div class="grid items-end gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
              <label class="grid gap-1 text-sm font-medium">
                {{ 'admin.categories.nameAr' | transloco }}
                <input #ar class="field" [value]="category.name" maxlength="100" />
              </label>
              <label class="grid gap-1 text-sm font-medium">
                {{ 'admin.categories.nameEn' | transloco }}
                <input
                  #en
                  class="field"
                  dir="ltr"
                  maxlength="100"
                  [value]="category.nameEn ?? ''"
                  [placeholder]="'admin.categories.enPlaceholder' | transloco"
                />
              </label>
              <button
                type="button"
                class="btn btn-accent"
                [disabled]="savingId() === category.id"
                (click)="save(category, ar.value, en.value)"
              >
                {{ 'admin.save' | transloco }}
              </button>
            </div>
          }
        </div>
      }
    }
  `,
})
export class AdminCategories {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  protected readonly savingId = signal<number | null>(null);
  protected readonly state = toSignal(
    this.reload$.pipe(switchMap(() => this.admin.categories().pipe(toLoadState()))),
    { initialValue: { status: 'loading' } as LoadState<AdminCategory[]> },
  );

  protected categories(): AdminCategory[] {
    const current = this.state();
    return current.status === 'ready' ? current.data : [];
  }

  protected save(category: AdminCategory, name: string, nameEn: string): void {
    if (name.trim().length < 2) {
      this.toasts.show({ kind: 'error', key: 'admin.categories.nameRequired' });
      return;
    }
    this.savingId.set(category.id);
    this.admin
      .updateCategory(category.id, { name: name.trim(), nameEn: nameEn.trim() || null })
      .subscribe({
        next: () => {
          this.savingId.set(null);
          this.toasts.show({ kind: 'success', key: 'admin.saved' });
          this.reload$.next();
        },
        error: () => {
          this.savingId.set(null);
          this.toasts.show({ kind: 'error', key: 'admin.saveFailed' });
        },
      });
  }
}
