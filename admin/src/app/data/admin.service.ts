import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { PagedResult, ProductDetails } from '@shared/core/models/api.models';
import { Order, OrderStatus } from '@shared/core/orders/order.models';
import {
  AdminCategory,
  AdminReview,
  AdminMessage,
  AdminUser,
  AdminOrderRow,
  AdminProductRow,
  AdminStats,
  ProductPayload,
} from './admin.models';

function toParams(query: Record<string, string | number | boolean | undefined | null>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '')
      params = params.set(key, String(value));
  }
  return params;
}

/** بداية يوم (بتوقيت المتصفح) + dayOffset يوم، كلحظة ISO. */
function startOfLocalDay(date: string, dayOffset: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day + dayOffset).toISOString();
}

/** كل مكالمات لوحة التحكم (الـ API بيرفضها لأي حد مش Admin). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  stats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.api}/admin/stats`);
  }

  products(query: {
    search?: string;
    active?: boolean;
    categoryId?: number;
    stock?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PagedResult<AdminProductRow>> {
    return this.http.get<PagedResult<AdminProductRow>>(`${this.api}/admin/products`, {
      params: toParams(query),
    });
  }

  product(id: number): Observable<ProductDetails & { categoryId: number; brandId: number }> {
    return this.http.get<ProductDetails & { categoryId: number; brandId: number }>(
      `${this.api}/admin/products/${id}`,
    );
  }

  createProduct(payload: ProductPayload): Observable<ProductDetails> {
    return this.http.post<ProductDetails>(`${this.api}/products`, payload);
  }

  updateProduct(id: number, payload: ProductPayload): Observable<void> {
    return this.http.put<void>(`${this.api}/products/${id}`, payload);
  }

  /** "حذف" ناعم: المنتج بيتخفي من الموقع بس الطلبات القديمة تفضل شايفاه. */
  hideProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/products/${id}`);
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ url: string }>(`${this.api}/admin/uploads`, body);
  }

  /** from / to: تواريخ yyyy-MM-dd بتوقيت المستخدم (to شامل اليوم ده). بتتحوّل للحظات UTC للـ API. */
  orders(query: {
    status?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PagedResult<AdminOrderRow>> {
    const { from, to, ...rest } = query;
    return this.http.get<PagedResult<AdminOrderRow>>(`${this.api}/admin/orders`, {
      params: toParams({
        ...rest,
        from: from ? startOfLocalDay(from, 0) : undefined,
        to: to ? startOfLocalDay(to, 1) : undefined,
      }),
    });
  }

  order(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.api}/admin/orders/${id}`);
  }

  /** The owner decides about an InstaPay transfer: "confirm", or "reject" with a reason for the customer. */
  reviewPayment(
    id: number,
    decision: 'confirm' | 'reject',
    note: string | null,
  ): Observable<Order> {
    return this.http.post<Order>(`${this.api}/admin/orders/${id}/payment`, { decision, note });
  }

  setOrderStatus(id: number, status: OrderStatus): Observable<Order> {
    return this.http.post<Order>(`${this.api}/admin/orders/${id}/status`, { status });
  }

  messages(query: {
    unread?: boolean;
    page?: number;
    pageSize?: number;
  }): Observable<PagedResult<AdminMessage>> {
    return this.http.get<PagedResult<AdminMessage>>(`${this.api}/admin/messages`, {
      params: toParams(query),
    });
  }

  markMessageRead(id: number, isRead: boolean): Observable<void> {
    return this.http.post<void>(`${this.api}/admin/messages/${id}/read`, null, {
      params: toParams({ isRead }),
    });
  }

  setTracking(
    id: number,
    body: { company: string | null; number: string | null },
  ): Observable<Order> {
    return this.http.put<Order>(`${this.api}/admin/orders/${id}/tracking`, body);
  }

  // ---- التقييمات
  reviews(page: number): Observable<PagedResult<AdminReview>> {
    return this.http.get<PagedResult<AdminReview>>(`${this.api}/admin/reviews`, {
      params: toParams({ page, pageSize: 20 }),
    });
  }

  deleteReview(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/admin/reviews/${id}`);
  }

  // ---- التصنيفات
  categories(): Observable<AdminCategory[]> {
    return this.http.get<AdminCategory[]>(`${this.api}/admin/categories`);
  }

  updateCategory(
    id: number,
    body: { name: string; nameEn: string | null },
  ): Observable<AdminCategory> {
    return this.http.put<AdminCategory>(`${this.api}/admin/categories/${id}`, body);
  }

  // ---- الأدمنز (فريق المتجر)
  adminUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.api}/admin/users`);
  }

  createAdmin(body: { email: string; fullName: string; password: string }): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${this.api}/admin/users`, body);
  }

  updateAdmin(id: number, body: { email: string; fullName: string }): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.api}/admin/users/${id}`, body);
  }

  setAdminPassword(
    id: number,
    body: { newPassword: string; currentPassword?: string },
  ): Observable<void> {
    return this.http.post<void>(`${this.api}/admin/users/${id}/password`, body);
  }

  setAdminActive(id: number, isActive: boolean): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${this.api}/admin/users/${id}/active`, { isActive });
  }
}
