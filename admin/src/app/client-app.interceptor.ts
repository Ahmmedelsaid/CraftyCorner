import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '@env/environment';

/**
 * بيعرّف الـ API إن الطلب جاي من لوحة التحكم، فيستخدم cookie جلسة خاص بيها
 * بدل اللي بيستخدمه المتجر (عشان دخول الأدمن ما يغيّرش جلسة العميل والعكس).
 */
export const clientAppInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith(environment.apiUrl)
    ? next(req.clone({ setHeaders: { 'X-Client-App': 'admin' } }))
    : next(req);
