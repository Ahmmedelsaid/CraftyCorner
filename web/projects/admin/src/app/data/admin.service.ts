import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { PagedResult, ProductDetails } from '@web/core/models/api.models';
import { Order, OrderStatus } from '@web/core/orders/order.models';
import {
  AdminMessage,
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

  orders(query: {
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PagedResult<AdminOrderRow>> {
    return this.http.get<PagedResult<AdminOrderRow>>(`${this.api}/admin/orders`, {
      params: toParams(query),
    });
  }

  order(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.api}/admin/orders/${id}`);
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
}
