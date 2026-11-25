import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from '@shared/core/auth/auth.service';
import { ProductListItem } from '@shared/core/models/api.models';
import { ToastService } from '@shared/core/toast/toast.service';

/**
 * Saved products ("favourites") of the signed-in customer. The list lives in the API; here is a copy in a
 * signal so every heart button and the header badge update at once. Anonymous visitors are sent to sign in.
 */
@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly baseUrl = `${environment.apiUrl}/wishlist`;

  private readonly state = signal<ProductListItem[] | null>(null);
  readonly items = computed(() => this.state() ?? []);
  readonly loaded = computed(() => this.state() !== null);
  readonly count = computed(() => this.items().length);
  private readonly ids = computed(() => new Set(this.items().map((item) => item.id)));

  constructor() {
    toObservable(computed(() => this.auth.user()?.id ?? null))
      .pipe(
        switchMap((userId) =>
          userId === null
            ? of(null)
            : this.http.get<ProductListItem[]>(this.baseUrl).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((items) => this.state.set(items));
  }

  has(productId: number): boolean {
    return this.ids().has(productId);
  }

  /** Adds or removes the product. `product` is only needed to show it in the list straight away. */
  toggle(product: ProductListItem): void {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const saved = this.has(product.id);
    // optimistic: the heart flips now, and flips back if the request fails
    this.state.update((list) =>
      saved ? (list ?? []).filter((item) => item.id !== product.id) : [product, ...(list ?? [])],
    );

    const request$ = saved
      ? this.http.delete<void>(`${this.baseUrl}/${product.id}`)
      : this.http.put<void>(`${this.baseUrl}/${product.id}`, null);

    request$.subscribe({
      error: () => {
        this.state.update((list) =>
          saved
            ? [product, ...(list ?? [])]
            : (list ?? []).filter((item) => item.id !== product.id),
        );
        this.toasts.show({ kind: 'error', key: 'wishlist.failed' });
      },
    });
  }
}
