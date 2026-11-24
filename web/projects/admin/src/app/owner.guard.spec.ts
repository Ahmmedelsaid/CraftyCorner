import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { ownerGuard } from './owner.guard';
import { AuthService } from '@web/core/auth/auth.service';

describe('ownerGuard', () => {
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
      ownerGuard({} as ActivatedRouteSnapshot, { url: '/orders' } as RouterStateSnapshot),
    );
  const urlOf = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('sends visitors to the login page and remembers the admin page', () => {
    expect(urlOf(run())).toBe('/login?returnUrl=%2Forders');
  });

  it('sends signed-in customers back to the login page', () => {
    authenticated.set(true);
    expect(urlOf(run())).toBe('/login?returnUrl=%2Forders');
  });

  it('lets the shop owner in', () => {
    authenticated.set(true);
    admin.set(true);
    expect(run()).toBe(true);
  });
});
