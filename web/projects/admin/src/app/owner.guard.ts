import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@web/core/auth/auth.service';

/** لوحة التحكم لصاحبة المتجر بس. أي حد تاني (زائر أو عميل) بيروح لصفحة دخول الأدمن. */
export const ownerGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  if (auth.isAuthenticated() && auth.isAdmin()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
