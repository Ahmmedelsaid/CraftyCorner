import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { LocalizedPipe } from './localized.pipe';

describe('LocalizedPipe', () => {
  const lang = signal<'ar' | 'en'>('ar');

  const pipe = () => {
    TestBed.configureTestingModule({
      providers: [{ provide: LanguageService, useValue: { lang } }],
    });
    return TestBed.runInInjectionContext(() => new LocalizedPipe());
  };

  it('shows the Arabic text in Arabic', () => {
    lang.set('ar');
    expect(pipe().transform('فازة', 'Vase')).toBe('فازة');
  });

  it('shows the English text in English when it exists', () => {
    lang.set('en');
    expect(pipe().transform('فازة', 'Vase')).toBe('Vase');
  });

  it('falls back to Arabic when the English text is empty', () => {
    lang.set('en');
    expect(pipe().transform('فازة', null)).toBe('فازة');
    expect(pipe().transform('فازة', '  ')).toBe('فازة');
  });
});
