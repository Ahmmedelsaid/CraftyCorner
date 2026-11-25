import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, timeout } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from '@web/core/auth/auth.interceptor';
import { clientAppInterceptor } from './client-app.interceptor';
import { AuthService } from '@web/core/auth/auth.service';
import { LanguageService } from '@web/core/i18n/language.service';
import { TranslocoHttpLoader } from '@web/core/i18n/transloco-loader';
import { problemDetailsInterceptor } from '@web/core/interceptors/problem-details.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: بارامترات الـ route (:id) بتوصل للـ component كـ input
    // withViewTransitions: انتقال ناعم بين الصفحات. withInMemoryScrolling: كل صفحة تبدأ من فوق،
    // والرجوع (Back) بيرجّع مكان التمرير القديم
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    // الترتيب مهم: problemDetails برّه، فالأخطاء بتعدّي على auth (يجدّد الـ token لو لزم) الأول
    provideHttpClient(
      withInterceptors([clientAppInterceptor, problemDetailsInterceptor, authInterceptor]),
    ),
    provideTransloco({
      config: {
        availableLangs: ['ar', 'en'],
        defaultLang: 'ar',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // بنحمّل ترجمة اللغة الحالية قبل أول render، عشان ما تظهرش المفاتيح للحظة
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      const lang = inject(LanguageService).lang();
      transloco.setActiveLang(lang);
      return firstValueFrom(transloco.load(lang));
    }),
    // بنرجّع جلسة المستخدم (لو الـ cookie لسه صالحة) قبل أول تنقّل، عشان الـ guards تعرف حالته.
    // لو السيرفر مش متاح بنكمّل كزائر بعد 4 ثواني.
    provideAppInitializer(() =>
      firstValueFrom(inject(AuthService).loadSession().pipe(timeout(4000))).catch(() => undefined),
    ),
  ],
};
