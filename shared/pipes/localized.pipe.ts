import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../core/i18n/language.service';

/**
 * Picks the English text when the site is in English and the owner filled it in; otherwise the Arabic one.
 * Usage: {{ product.name | localized: product.nameEn }}
 * Impure on purpose: it must re-run when the language signal changes, and the work is a single comparison.
 */
@Pipe({ name: 'localized', pure: false })
export class LocalizedPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(arabic: string | null | undefined, english: string | null | undefined): string {
    const text = this.language.lang() === 'en' && english?.trim() ? english : arabic;
    return text ?? '';
  }
}
