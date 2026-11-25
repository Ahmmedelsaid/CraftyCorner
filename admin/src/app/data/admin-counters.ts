import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AdminStats } from './admin.models';
import { AdminService } from './admin.service';

/**
 * The two numbers on the sidebar (new orders, unread messages), kept in one place as signals.
 * Any page that changes them says so (`adjustUnread`, `refresh`), and the badges follow at once,
 * instead of waiting for the next time the owner clicks somewhere. The shell also refreshes them
 * on every navigation and every half minute, so a new order shows up while the page is just open.
 */
@Injectable({ providedIn: 'root' })
export class AdminCounters {
  private readonly admin = inject(AdminService);
  private readonly stats = signal<AdminStats | null>(null);

  readonly newOrders = computed(() => this.stats()?.ordersByStatus['Placed'] ?? 0);
  readonly unreadMessages = computed(() => this.stats()?.unreadMessages ?? 0);

  /** Asks the API for the current numbers. */
  refresh(): void {
    this.admin
      .stats()
      .pipe(catchError(() => of<AdminStats | null>(null)))
      .subscribe((stats) => {
        if (stats) this.stats.set(stats);
      });
  }

  /** A message was marked read (-1) or unread (+1): the badge moves now, without waiting for the API. */
  adjustUnread(delta: number): void {
    this.stats.update((stats) =>
      stats ? { ...stats, unreadMessages: Math.max(0, stats.unreadMessages + delta) } : stats,
    );
  }

  /** Back to nothing (after signing out, so the next owner does not see the previous numbers). */
  clear(): void {
    this.stats.set(null);
  }
}
