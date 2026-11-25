import { OrderStatus } from '@shared/core/orders/order.models';

export interface AdminProductRow {
  id: number;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  isActive: boolean;
  imageUrl: string | null;
  categoryName: string;
  categoryId: number;
}

export interface AdminOrderRow {
  id: number;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  shippingName: string;
  phone: string;
  city: string;
}

export interface AdminMessage {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  topic: string;
  orderNumber: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface AdminStats {
  ordersByStatus: Record<OrderStatus, number>;
  ordersToday: number;
  deliveredRevenue: number;
  openOrdersValue: number;
  activeProducts: number;
  unreadMessages: number;
  lowStock: { id: number; name: string; stockQuantity: number; imageUrl: string | null }[];
  last7Days: { date: string; orders: number }[];
}

/** نفس شكل CreateProductDto / UpdateProductDto في الـ API. */
export interface ProductPayload {
  name: string;
  nameEn: string | null;
  descriptionEn: string | null;
  slug: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stockQuantity: number;
  categoryId: number;
  brandId: number;
  isActive: boolean;
  specs: Record<string, string>;
}

/** أي حالة تقدر ننقل لها الطلب من الحالة الحالية (نفس قواعد الـ API؛ الـ API هو اللي بيحكم). */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  Placed: ['Confirmed', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

export const ORDER_STATUSES: OrderStatus[] = [
  'Placed',
  'Confirmed',
  'Preparing',
  'Shipped',
  'Delivered',
  'Cancelled',
];

/** رقم واتساب بالصيغة الدولية من رقم مصري محلي (01012345678 أو +20 101 ...). */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `20${digits.slice(1)}`;
  return digits;
}

/** حساب أدمن في صفحة "الفريق". */
export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  isCurrentUser: boolean;
}

export interface AdminCategory {
  id: number;
  name: string;
  nameEn: string | null;
  slug: string;
  parentId: number | null;
  isActive: boolean;
  productCount: number;
}
