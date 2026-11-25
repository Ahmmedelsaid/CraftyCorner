import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '@env/environment';
import { AuthResponse } from '@shared/core/auth/auth.models';
import { AuthService } from '@shared/core/auth/auth.service';
import { ProductListItem } from '@shared/core/models/api.models';
import { ToastService } from '@shared/core/toast/toast.service';
import { WishlistService } from './wishlist.service';

const URL = `${environment.apiUrl}/wishlist`;

const product = (id: number): ProductListItem => ({
  id,
  name: `Product ${id}`,
  slug: `product-${id}`,
  price: 100,
  imageUrl: null,
  brandName: 'Acme',
  categoryName: 'Decor',
  nameEn: null,
  categoryNameEn: null,
  ratingAverage: 0,
  ratingCount: 0,
});

const session: AuthResponse = {
  accessToken: 'token',
  expiresAtUtc: '2030-01-01T00:00:00Z',
  user: {
    id: 7,
    email: 'ana@example.com',
    fullName: 'Ana Test',
    role: 'Customer',
    phone: null,
    address: null,
    city: null,
  },
};

describe('WishlistService', () => {
  let wishlist: WishlistService;
  let auth: AuthService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    wishlist = TestBed.inject(WishlistService);
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  /** Signs in and answers the list request that follows. */
  function signIn(saved: ProductListItem[] = []): void {
    auth.login({ email: 'ana@example.com', password: 'Passw0rd!1' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(session);
    TestBed.tick();
    http.expectOne(URL).flush(saved);
  }

  it('is empty and sends nothing while nobody is signed in', () => {
    TestBed.tick();
    expect(wishlist.items()).toEqual([]);
    expect(wishlist.loaded()).toBe(false);
    http.expectNone(URL);
  });

  it('loads the saved products when the customer signs in', () => {
    signIn([product(1), product(2)]);

    expect(wishlist.count()).toBe(2);
    expect(wishlist.loaded()).toBe(true);
    expect(wishlist.has(1)).toBe(true);
    expect(wishlist.has(3)).toBe(false);
  });

  it('adds a product at once and tells the API', () => {
    signIn();

    wishlist.toggle(product(5));
    expect(wishlist.has(5)).toBe(true);

    const put = http.expectOne(`${URL}/5`);
    expect(put.request.method).toBe('PUT');
    put.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('removes a saved product at once and tells the API', () => {
    signIn([product(5)]);

    wishlist.toggle(product(5));
    expect(wishlist.has(5)).toBe(false);

    const del = http.expectOne(`${URL}/5`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('puts the heart back and shows an error when adding fails', () => {
    signIn();
    const toasts = TestBed.inject(ToastService);

    wishlist.toggle(product(5));
    http.expectOne(`${URL}/5`).flush(null, { status: 500, statusText: 'Server Error' });

    expect(wishlist.has(5)).toBe(false);
    expect(toasts.toasts().at(-1)?.key).toBe('wishlist.failed');
  });

  it('brings a removed product back when the request fails', () => {
    signIn([product(5)]);

    wishlist.toggle(product(5));
    http.expectOne(`${URL}/5`).flush(null, { status: 500, statusText: 'Server Error' });

    expect(wishlist.has(5)).toBe(true);
  });

  it('sends an anonymous visitor to sign in instead of saving', () => {
    wishlist.toggle(product(5));

    expect(wishlist.has(5)).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], expect.anything());
    http.expectNone(`${URL}/5`);
  });

  it('empties the list when the customer signs out', () => {
    signIn([product(1)]);
    expect(wishlist.count()).toBe(1);

    auth.logout().subscribe();
    http.expectOne(`${environment.apiUrl}/auth/logout`).flush(null);
    TestBed.tick();

    expect(wishlist.count()).toBe(0);
    expect(wishlist.loaded()).toBe(false);
  });
});
