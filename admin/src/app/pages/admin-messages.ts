import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BehaviorSubject, combineLatest, switchMap } from 'rxjs';
import { AdminMessage, toWhatsAppNumber } from '../data/admin.models';
import { AdminService } from '../data/admin.service';
import { PagedResult } from '@shared/core/models/api.models';
import { LoadState, toLoadState } from '@shared/core/state/load-state';
import { DateTimePipe } from '@shared/pipes/date-time.pipe';

/** رسائل صفحة "اتصل بنا": غير المقروء الأول، وعلّم كمقروء، ورد بالإيميل أو واتساب. */
@Component({
  selector: 'app-admin-messages',
  imports: [RouterLink, TranslocoPipe, DateTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex gap-2">
      <button
        type="button"
        class="rounded-full border px-3.5 py-1.5 text-sm"
        [class]="
          !unreadOnly() ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface'
        "
        (click)="unreadOnly.set(false)"
      >
        {{ 'admin.all' | transloco }}
      </button>
      <button
        type="button"
        class="rounded-full border px-3.5 py-1.5 text-sm"
        [class]="
          unreadOnly() ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface'
        "
        (click)="unreadOnly.set(true)"
      >
        {{ 'admin.messages.unread' | transloco }}
      </button>
    </div>

    @let current = state();
    @if (current.status === 'ready') {
      @if (current.data.items.length === 0) {
        <p class="card p-8 text-center text-muted">{{ 'admin.messages.empty' | transloco }}</p>
      } @else {
        <ul class="grid gap-3">
          @for (message of current.data.items; track message.id) {
            <li class="card p-4" [class.border-highlight]="!message.isRead">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p class="font-bold">{{ message.subject }}</p>
                @if (!message.isRead) {
                  <span
                    class="rounded-full bg-highlight/25 px-2 py-0.5 text-xs font-bold text-highlight-strong"
                  >
                    {{ 'admin.messages.new' | transloco }}
                  </span>
                }
                <span class="ms-auto text-xs text-muted">{{ message.createdAt | dateTime }}</span>
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ message.name }} · <span dir="ltr">{{ message.email }}</span>
                @if (message.phone) {
                  · <span dir="ltr">{{ message.phone }}</span>
                }
                · {{ 'contact.topic.' + message.topic | transloco }}
                @if (message.orderNumber) {
                  ·
                  <a
                    [routerLink]="['/orders', message.orderNumber]"
                    class="font-semibold text-accent"
                  >
                    #{{ message.orderNumber }}
                  </a>
                }
              </p>
              <p class="mt-3 whitespace-pre-line">{{ message.message }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <a
                  class="btn !py-1.5"
                  [href]="
                    'mailto:' + message.email + '?subject=' + encode('Re: ' + message.subject)
                  "
                >
                  {{ 'admin.messages.replyEmail' | transloco }}
                </a>
                @if (message.phone) {
                  <a
                    class="btn !py-1.5"
                    [href]="'https://wa.me/' + whatsApp(message)"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ 'admin.order.whatsapp' | transloco }}
                  </a>
                }
                <button type="button" class="btn !py-1.5" (click)="toggle(message)">
                  {{
                    (message.isRead ? 'admin.messages.markUnread' : 'admin.messages.markRead')
                      | transloco
                  }}
                </button>
              </div>
            </li>
          }
        </ul>
      }
    } @else if (current.status === 'loading') {
      <div class="card skeleton h-24" aria-hidden="true"></div>
    } @else {
      <p class="card p-6 text-danger" role="alert">{{ 'admin.loadError' | transloco }}</p>
    }
  `,
})
export class AdminMessages {
  private readonly admin = inject(AdminService);
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  protected readonly unreadOnly = signal(false);
  private readonly filter = computed(() => this.unreadOnly());

  protected readonly state = toSignal(
    combineLatest([toObservable(this.filter), this.reload$]).pipe(
      switchMap(([unread]) =>
        this.admin.messages({ unread: unread || undefined, pageSize: 50 }).pipe(toLoadState()),
      ),
    ),
    { initialValue: { status: 'loading' } as LoadState<PagedResult<AdminMessage>> },
  );

  protected whatsApp(message: AdminMessage): string {
    return toWhatsAppNumber(message.phone ?? '');
  }

  protected encode(value: string): string {
    return encodeURIComponent(value);
  }

  protected toggle(message: AdminMessage): void {
    this.admin.markMessageRead(message.id, !message.isRead).subscribe(() => this.reload$.next());
  }
}
