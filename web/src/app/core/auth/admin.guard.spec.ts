import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { adminGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('adminGuard', () => {
  const authenticated = signal(false);
  const admin = signal(false);

  beforeEach(() => {
    authenticated.set(false);
    admin.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isAuthenticated: () => authenticated(), isAdmin: () => admin() },
        },
      ],
    });
  });

  const run = () =>
    TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: '/admin/orders' } as RouterStateSnapshot),
    );
  const urlOf = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('sends visitors to the login page and remembers the admin page', () => {
    expect(urlOf(run())).toBe('/login?returnUrl=%2Fadmin%2Forders');
  });

  it('sends signed-in customers to the home page', () => {
    authenticated.set(true);
    expect(urlOf(run())).toBe('/');
  });

  it('lets the shop owner in', () => {
    authenticated.set(true);
    admin.set(true);
    expect(run()).toBe(true);
  });
});
