import { NEXT_STATUSES, ORDER_STATUSES, toWhatsAppNumber } from './admin.models';

describe('toWhatsAppNumber', () => {
  it('turns a local Egyptian number into the international form', () => {
    expect(toWhatsAppNumber('01012345678')).toBe('201012345678');
  });

  it('keeps an already international number and strips symbols', () => {
    expect(toWhatsAppNumber('+20 101 234 5678')).toBe('201012345678');
    expect(toWhatsAppNumber('0020 101 234 5678')).toBe('201012345678');
  });
});

describe('order workflow', () => {
  it('has a next step for every open status and none for the final ones', () => {
    expect(NEXT_STATUSES.Placed).toEqual(['Confirmed', 'Cancelled']);
    expect(NEXT_STATUSES.Shipped).toEqual(['Delivered', 'Cancelled']);
    expect(NEXT_STATUSES.Delivered).toEqual([]);
    expect(NEXT_STATUSES.Cancelled).toEqual([]);
  });

  it('only ever moves forward or cancels', () => {
    for (const status of ORDER_STATUSES) {
      for (const next of NEXT_STATUSES[status]) {
        expect(
          next === 'Cancelled' || ORDER_STATUSES.indexOf(next) > ORDER_STATUSES.indexOf(status),
        ).toBe(true);
      }
    }
  });
});
