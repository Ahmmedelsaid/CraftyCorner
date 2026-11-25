export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  /** رقم الموبايل (01XXXXXXXXX). ناقص عند الحسابات القديمة. */
  phone: string | null;
  /** عنوان التوصيل الافتراضي (بيتملا تلقائي في إتمام الطلب). */
  address: string | null;
  city: string | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresAtUtc: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  phone: string;
  address: string | null;
  city: string | null;
}
