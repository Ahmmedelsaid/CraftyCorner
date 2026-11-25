import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import { environment } from '@env/environment';
import { AuthResponse } from '@shared/core/auth/auth.models';
import { AuthService } from '@shared/core/auth/auth.service';
import { ReviewSummary } from '@shared/core/models/api.models';
import { ProductReviews } from './product-reviews';

class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

const URL = `${environment.apiUrl}/products/3/reviews`;

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

const summary = (overrides: Partial<ReviewSummary> = {}): ReviewSummary => ({
  average: 4.5,
  count: 2,
  distribution: [0, 0, 0, 1, 1],
  items: [
    {
      id: 1,
      rating: 5,
      comment: 'Beautiful and well made',
      authorName: 'Sara M.',
      createdAt: '2026-11-20T10:00:00Z',
      isMine: false,
    },
    {
      id: 2,
      rating: 4,
      comment: null,
      authorName: 'Omar K.',
      createdAt: '2026-11-21T10:00:00Z',
      isMine: false,
    },
  ],
  canReview: false,
  ...overrides,
});

describe('ProductReviews', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProductReviews],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            missingHandler: { logMissingKey: false },
          },
          loader: EmptyLoader,
        }),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(data: ReviewSummary, signedIn = false) {
    if (signedIn) {
      TestBed.inject(AuthService)
        .login({ email: 'ana@example.com', password: 'Passw0rd!1' })
        .subscribe();
      http.expectOne(`${environment.apiUrl}/auth/login`).flush(session);
    }
    const fixture = TestBed.createComponent(ProductReviews);
    fixture.componentRef.setInput('productId', 3);
    await fixture.whenStable();
    http.expectOne(URL).flush(data);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the average, the count and each review', async () => {
    const { element } = await render(summary());

    expect(element.textContent).toContain('4.5');
    expect(element.textContent).toContain('Beautiful and well made');
    expect(element.textContent).toContain('Sara M.');
    expect(element.textContent).toContain('Omar K.');
  });

  it('says there are no reviews yet when the list is empty', async () => {
    const { element } = await render(
      summary({ count: 0, average: 0, items: [], distribution: [0, 0, 0, 0, 0] }),
    );

    expect(element.textContent).toContain('reviews.none');
    expect(element.querySelector('textarea')).toBeNull();
  });

  it('shows no form to a visitor who is not signed in', async () => {
    const { element } = await render(summary());

    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).toContain('reviews.signIn');
  });

  it('tells a signed-in customer who has not received the product to wait for delivery', async () => {
    const { element } = await render(summary({ canReview: false }), true);

    expect(element.querySelector('form')).toBeNull();
    expect(element.textContent).toContain('reviews.afterDelivery');
  });

  it('lets a customer who received the product pick stars and submit', async () => {
    const { fixture, element } = await render(summary({ canReview: true }), true);

    const submit = element.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
    expect(submit.disabled).toBe(true); // no stars yet

    const stars = element.querySelectorAll<HTMLButtonElement>('form [role="radio"]');
    stars[3].click(); // four stars
    await fixture.whenStable();
    expect(submit.disabled).toBe(false);

    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const put = http.expectOne(URL);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ rating: 4, comment: null });
    put.flush(null, { status: 204, statusText: 'No Content' });

    // the list is loaded again after saving
    http.expectOne(URL).flush(summary({ canReview: true }));
  });

  it('lets the customer delete their own review only', async () => {
    const mine = summary({
      items: [
        {
          id: 9,
          rating: 5,
          comment: 'Mine',
          authorName: 'Ana T.',
          createdAt: '2026-11-22T10:00:00Z',
          isMine: true,
        },
      ],
      count: 1,
    });
    const { element } = await render(mine, true);

    const remove = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('reviews.delete'),
    )!;
    remove.click();
    const del = http.expectOne(URL);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(URL).flush(summary());
  });
});
