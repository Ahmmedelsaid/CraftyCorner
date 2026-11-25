export type OrderStatus =
  'Placed' | 'Confirmed' | 'Preparing' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface OrderItem {
  productId: number;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  /** English name of the product (from the catalogue), when the owner entered one. */
  nameEn?: string | null;
}

export interface Order {
  id: number;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  cancelledAt: string | null;
  shippingName: string;
  phone: string;
  address: string;
  city: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  items: OrderItem[];
  trackingCompany: string | null;
  trackingNumber: string | null;
}

/** صف في سجل الطلبات: صور مصغّرة بدل كل المنتجات. */
export interface OrderSummary {
  id: number;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  imageUrls: string[];
}

export interface PlaceOrderRequest {
  shippingName: string;
  phone: string;
  address: string;
  city: string;
  notes: string | null;
  /** مكان الدبوس على الخريطة (اختياري): الاتنين مع بعض أو الاتنين null. */
  latitude: number | null;
  longitude: number | null;
}

/** نفس شكل رقم التليفون المقبول في الـ API. */
export const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,18}[0-9]$/;
