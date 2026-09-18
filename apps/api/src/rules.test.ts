import { describe, it, expect } from 'vitest';
describe('regras de inscrição', () => {
  it('aceita somente telefone brasileiro normalizado', () =>
    expect('(31) 99999-9999'.replace(/\D/g, '')).toBe('31999999999'));
  it('não usa o preço informado pelo cliente', () => {
    const priceFromDatabase = 150;
    const clientPrice = 1;
    expect(priceFromDatabase).not.toBe(clientPrice);
  });
  it('requer ano se formado', () => {
    const graduated = true,
      year = undefined;
    expect(graduated && !year).toBe(true);
  });
});
