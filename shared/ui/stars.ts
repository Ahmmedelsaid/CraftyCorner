import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from './icon';

/** Five stars filled to `value` (0 to 5, fractions allowed). Read-only display. */
@Component({
  selector: 'app-stars',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-flex align-middle', '[attr.aria-label]': 'label()', role: 'img' },
  template: `
    <span class="inline-flex text-border" aria-hidden="true">
      @for (star of stars; track star) {
        <app-icon name="star" [size]="size()" />
      }
    </span>
    <span
      class="absolute inset-y-0 start-0 inline-flex overflow-hidden text-highlight"
      [style.width.%]="percent()"
      aria-hidden="true"
    >
      @for (star of stars; track star) {
        <app-icon name="star" [size]="size()" class="shrink-0" />
      }
    </span>
  `,
})
export class Stars {
  readonly value = input.required<number>();
  readonly size = input(1);

  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly percent = computed(() => Math.max(0, Math.min(5, this.value())) * 20);
  protected readonly label = computed(() => `${this.value().toFixed(1)} / 5`);
}
