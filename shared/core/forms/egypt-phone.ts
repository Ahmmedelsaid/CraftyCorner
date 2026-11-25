import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * رقم موبايل مصري بأي شكل بيكتبه العميل (01011252834 أو +20 101 125 2834 أو 0020...)،
 * بيرجّع الشكل المحلي 01XXXXXXXXX، أو null لو مش رقم موبايل مصري. نفس منطق الـ API.
 */
export function normalizeEgyptPhone(input: string | null | undefined): string | null {
  let digits = (input ?? '').replace(/\D/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) digits = '0' + digits;
  return /^01[0125]\d{8}$/.test(digits) ? digits : null;
}

/** فاضي مقبول (استخدم Validators.required مع الحقول الإجبارية). كود الخطأ pattern. */
export function egyptPhoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string | null) ?? '';
  return value.trim() === '' || normalizeEgyptPhone(value) !== null ? null : { pattern: true };
}
