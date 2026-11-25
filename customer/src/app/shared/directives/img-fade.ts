import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/**
 * الصورة بتظهر بنعومة (fade) لما تخلص تحميل، بدل ما تظهر فجأة فوق مكانها الفاضي:
 *   <img appImgFade [src]="..." />
 * لو الصورة كانت في الكاش (complete) بتظهر فوراً. لو فشلت بنظهرها برضو عشان الـ alt يبان.
 */
@Directive({
  selector: 'img[appImgFade]',
  host: { class: 'img-fade' },
})
export class ImgFade {
  constructor() {
    const image = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
    const show = () => image.classList.add('is-loaded');

    image.addEventListener('load', show, { once: true });
    image.addEventListener('error', show, { once: true });
    afterNextRender(() => {
      if (image.complete) show();
    });
  }
}
