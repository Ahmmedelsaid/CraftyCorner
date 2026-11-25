import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '@env/environment';
import { GOVERNORATES, Governorate } from '../geo/governorates';

/** The shop's rules, from the API. Until the answer arrives (or if it never does) the defaults below are used. */
export interface ShopInfo {
  shippingFee: number;
  deliveryCities: string[];
}

const DEFAULTS: ShopInfo = { shippingFee: 100, deliveryCities: ['Cairo', 'Giza', 'Qalyubia'] };

@Injectable({ providedIn: 'root' })
export class ShopService {
  private readonly info = signal<ShopInfo>(DEFAULTS);

  readonly shippingFee = computed(() => this.info().shippingFee);

  /** The governorates the shop delivers to (the ones the checkout and the account offer). */
  readonly governorates = computed<readonly Governorate[]>(() => {
    const allowed = this.info().deliveryCities.map((city) => city.toLowerCase());
    return GOVERNORATES.filter((governorate) => allowed.includes(governorate.value.toLowerCase()));
  });

  constructor() {
    inject(HttpClient)
      .get<ShopInfo>(`${environment.apiUrl}/shop`)
      .pipe(catchError(() => of(null)))
      .subscribe((info) => {
        if (info?.deliveryCities?.length) this.info.set(info);
      });
  }

  delivers(value: string): boolean {
    return this.governorates().some((governorate) => governorate.value === value);
  }
}
