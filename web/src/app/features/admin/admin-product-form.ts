import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, catchError, of } from 'rxjs';
import { ProductPayload } from '../../core/admin/admin.models';
import { AdminService } from '../../core/admin/admin.service';
import { firstError } from '../../core/forms/form-errors';
import { Category } from '../../core/models/api.models';
import { CatalogService } from '../../core/services/catalog.service';
import { ToastService } from '../../core/toast/toast.service';

/** slug و SKU بيتولّدوا لوحدهم عشان صاحبة المتجر ما تحتاجش تفكر فيهم (الاسم عربي). */
function randomCode(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** إضافة منتج جديد أو تعديل منتج: بيانات، سعر، مخزون، صورة بترفع من الجهاز، ومواصفات. */
@Component({
  selector: 'app-admin-product-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/admin/products" class="mb-4 inline-block text-sm font-semibold text-accent">
      ← {{ 'admin.products.back' | transloco }}
    </a>
    <h2 class="mb-5 text-2xl font-bold">
      {{ (productId ? 'admin.products.editTitle' : 'admin.products.addTitle') | transloco }}
    </h2>

    @if (loadFailed()) {
      <p class="card p-6 text-danger" role="alert">{{ 'admin.loadError' | transloco }}</p>
    } @else {
      <form
        [formGroup]="form"
        (ngSubmit)="save()"
        class="grid gap-5 lg:grid-cols-[1fr_1.4fr]"
        novalidate
      >
        <section class="card grid content-start gap-3 p-5">
          <h3 class="font-bold">{{ 'admin.products.photo' | transloco }}</h3>
          <div class="arch mx-auto aspect-[4/5] w-full max-w-64">
            @if (form.controls.imageUrl.value; as image) {
              <img [src]="image" alt="" />
            } @else {
              <div class="grid size-full place-items-center p-4 text-center text-sm text-muted">
                {{ 'admin.products.noPhoto' | transloco }}
              </div>
            }
          </div>
          <label class="btn cursor-pointer justify-self-center">
            {{
              (uploading() ? 'admin.products.uploading' : 'admin.products.choosePhoto') | transloco
            }}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="sr-only"
              [disabled]="uploading()"
              (change)="upload($event)"
            />
          </label>
          @if (form.controls.imageUrl.value) {
            <button
              type="button"
              class="text-sm text-muted underline"
              (click)="form.controls.imageUrl.setValue('')"
            >
              {{ 'admin.products.removePhoto' | transloco }}
            </button>
          }
          <p class="text-center text-xs text-muted">{{ 'admin.products.photoHint' | transloco }}</p>
        </section>

        <section class="card grid content-start gap-4 p-5">
          <label class="grid gap-1 text-sm font-medium">
            {{ 'admin.products.name' | transloco }}
            <input class="field" formControlName="name" />
            @if (error('name'); as key) {
              <span class="text-xs text-danger" role="alert">{{ key | transloco }}</span>
            }
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="grid gap-1 text-sm font-medium">
              {{ 'admin.products.category' | transloco }}
              <select class="field" formControlName="categoryId">
                <option [ngValue]="0" disabled>
                  {{ 'admin.products.chooseCategory' | transloco }}
                </option>
                @for (category of categories(); track category.id) {
                  <option [ngValue]="category.id">{{ category.name }}</option>
                }
              </select>
              @if (error('categoryId'); as key) {
                <span class="text-xs text-danger" role="alert">{{ key | transloco }}</span>
              }
            </label>
            <label class="grid gap-1 text-sm font-medium">
              {{ 'admin.products.price' | transloco }}
              <input
                class="field"
                type="number"
                min="1"
                step="1"
                inputmode="decimal"
                formControlName="price"
              />
              @if (error('price'); as key) {
                <span class="text-xs text-danger" role="alert">{{ key | transloco }}</span>
              }
            </label>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="grid gap-1 text-sm font-medium">
              {{ 'admin.products.stockQty' | transloco }}
              <input
                class="field"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                formControlName="stockQuantity"
              />
              @if (error('stockQuantity'); as key) {
                <span class="text-xs text-danger" role="alert">{{ key | transloco }}</span>
              }
            </label>
            <label
              class="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2 text-sm font-medium"
            >
              <input
                type="checkbox"
                formControlName="isActive"
                class="size-4 accent-[var(--color-accent)]"
              />
              {{ 'admin.products.visible' | transloco }}
            </label>
          </div>

          <label class="grid gap-1 text-sm font-medium">
            {{ 'admin.products.description' | transloco }}
            <textarea class="field" rows="4" formControlName="description"></textarea>
          </label>

          <fieldset class="grid gap-2">
            <legend class="mb-1 text-sm font-medium">
              {{ 'admin.products.specs' | transloco }}
            </legend>
            @for (row of specs.controls; track row; let i = $index) {
              <div class="flex gap-2" [formGroup]="row">
                <input
                  class="field"
                  formControlName="key"
                  [placeholder]="'admin.products.specKey' | transloco"
                />
                <input
                  class="field"
                  formControlName="value"
                  [placeholder]="'admin.products.specValue' | transloco"
                />
                <button
                  type="button"
                  class="btn !px-3"
                  [attr.aria-label]="'admin.remove' | transloco"
                  (click)="specs.removeAt(i)"
                >
                  ×
                </button>
              </div>
            }
            <button type="button" class="btn justify-self-start !py-1.5" (click)="addSpec()">
              + {{ 'admin.products.addSpec' | transloco }}
            </button>
          </fieldset>

          <details class="rounded-lg border border-border p-3 text-sm">
            <summary class="cursor-pointer font-medium">
              {{ 'admin.products.advanced' | transloco }}
            </summary>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <label class="grid gap-1 font-medium">
                SKU
                <input class="field" dir="ltr" formControlName="sku" />
                @if (error('sku'); as key) {
                  <span class="text-xs text-danger" role="alert">{{ key | transloco }}</span>
                }
              </label>
              <label class="grid gap-1 font-medium">
                Slug
                <input class="field" dir="ltr" formControlName="slug" />
                @if (error('slug'); as key) {
                  <span class="text-xs text-danger" role="alert">{{ key | transloco }}</span>
                }
              </label>
            </div>
          </details>

          <div class="flex flex-wrap gap-3 border-t border-border pt-4">
            <button type="submit" class="btn btn-accent !px-8" [disabled]="saving() || uploading()">
              {{ (saving() ? 'admin.saving' : 'admin.save') | transloco }}
            </button>
            <a routerLink="/admin/products" class="btn">{{ 'admin.cancel' | transloco }}</a>
          </div>
        </section>
      </form>
    }
  `,
})
export class AdminProductForm {
  private readonly admin = inject(AdminService);
  private readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly productId: number | null =
    Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly submitted = signal(false);
  private brandId = 0;

  protected readonly categories = toSignal(this.catalog.categories$, {
    initialValue: [] as Category[],
  });
  protected readonly brands = toSignal(this.catalog.brands$, { initialValue: [] });

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    }),
    categoryId: new FormControl(0, { nonNullable: true, validators: [Validators.min(1)] }),
    price: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),
    stockQuantity: new FormControl<number | null>(1, {
      validators: [Validators.required, Validators.min(0)],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    imageUrl: new FormControl('', { nonNullable: true }),
    sku: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(50)],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    }),
    specs: new FormArray<FormGroup<{ key: FormControl<string>; value: FormControl<string> }>>([]),
  });

  protected get specs() {
    return this.form.controls.specs;
  }

  constructor() {
    if (this.productId === null) {
      const code = randomCode();
      this.form.patchValue({ sku: `CC-${code.toUpperCase()}`, slug: `cc-${code}` });
      this.addSpec();
    } else {
      this.admin
        .product(this.productId)
        .pipe(catchError(() => of(null)))
        .subscribe((product) => {
          if (!product) {
            this.loadFailed.set(true);
            return;
          }
          this.brandId = product.brandId;
          this.form.patchValue({
            name: product.name,
            categoryId: product.categoryId,
            price: product.price,
            stockQuantity: product.stockQuantity,
            isActive: product.isActive,
            description: product.description ?? '',
            imageUrl: product.imageUrl ?? '',
            sku: product.sku,
            slug: product.slug,
          });
          for (const [key, value] of Object.entries(product.specs)) this.addSpec(key, value);
        });
    }
  }

  protected addSpec(key = '', value = ''): void {
    this.specs.push(
      new FormGroup({
        key: new FormControl(key, { nonNullable: true }),
        value: new FormControl(value, { nonNullable: true }),
      }),
    );
  }

  protected error(
    name: 'name' | 'categoryId' | 'price' | 'stockQuantity' | 'sku' | 'slug',
  ): string | null {
    const control = this.form.controls[name];
    return firstError(
      control,
      {
        required: 'admin.err.required',
        min: 'admin.err.min',
        minlength: 'admin.err.short',
        maxlength: 'admin.err.long',
        pattern: 'admin.err.slug',
      },
      this.submitted() || control.touched,
    );
  }

  protected upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.admin.uploadImage(file).subscribe({
      next: ({ url }) => {
        this.form.controls.imageUrl.setValue(url);
        this.uploading.set(false);
        input.value = '';
      },
      error: () => {
        this.uploading.set(false);
        input.value = '';
        this.toasts.show({ kind: 'error', key: 'admin.products.uploadFailed' });
      },
    });
  }

  protected save(): void {
    this.submitted.set(true);
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const specs: Record<string, string> = {};
    for (const row of value.specs) {
      const key = row.key.trim();
      if (key && row.value.trim()) specs[key] = row.value.trim();
    }

    const brandId = this.brandId || this.brands()[0]?.id || 0;
    const payload: ProductPayload = {
      name: value.name.trim(),
      slug: value.slug,
      sku: value.sku,
      description: value.description.trim() || null,
      imageUrl: value.imageUrl || null,
      price: Number(value.price),
      stockQuantity: Number(value.stockQuantity),
      categoryId: value.categoryId,
      brandId,
      isActive: value.isActive,
      specs,
    };

    this.saving.set(true);
    const request$: Observable<unknown> =
      this.productId === null
        ? this.admin.createProduct(payload)
        : this.admin.updateProduct(this.productId, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.show({ kind: 'success', key: 'admin.saved' });
        void this.router.navigate(['/admin/products']);
      },
      error: () => {
        this.saving.set(false);
        this.toasts.show({ kind: 'error', key: 'admin.saveFailed' });
      },
    });
  }
}
