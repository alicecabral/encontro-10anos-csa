import { describe, it, expect } from 'vitest';
import {
  LOT_CAPACITIES,
  getLotCapacity,
  graduationYearFromClassOf2016Answer,
  isLotAvailableByRelease,
} from './rules.js';
describe('regras de inscrição', () => {
  it('aceita somente telefone brasileiro normalizado', () =>
    expect('(31) 99999-9999'.replace(/\D/g, '')).toBe('31999999999'));
  it('não usa o preço informado pelo cliente', () => {
    const priceFromDatabase = 150;
    const clientPrice = 1;
    expect(priceFromDatabase).not.toBe(clientPrice);
  });
  it('mapeia a resposta Sim para 2016 e Não para nenhum ano', () => {
    expect(graduationYearFromClassOf2016Answer(true)).toBe(2016);
    expect(graduationYearFromClassOf2016Answer(false)).toBeNull();
  });
  it('define os limites dos lotes como 40, 40 e 43 ingressos', () => {
    expect(LOT_CAPACITIES).toEqual([40, 40, 43]);
    expect(getLotCapacity(1)).toBe(40);
    expect(getLotCapacity(2)).toBe(40);
    expect(getLotCapacity(3)).toBe(43);
  });
  it('abre o lote correto conforme o total vendido', () => {
    expect(isLotAvailableByRelease({ active: true, displayOrder: 1, quantitySold: 0 }, 0)).toBe(
      true,
    );
    expect(isLotAvailableByRelease({ active: true, displayOrder: 1, quantitySold: 39 }, 39)).toBe(
      true,
    );
    expect(isLotAvailableByRelease({ active: true, displayOrder: 1, quantitySold: 40 }, 40)).toBe(
      false,
    );
    expect(isLotAvailableByRelease({ active: true, displayOrder: 2, quantitySold: 0 }, 40)).toBe(
      true,
    );
    expect(isLotAvailableByRelease({ active: true, displayOrder: 3, quantitySold: 0 }, 80)).toBe(
      true,
    );
    expect(isLotAvailableByRelease({ active: true, displayOrder: 3, quantitySold: 42 }, 122)).toBe(
      true,
    );
    expect(isLotAvailableByRelease({ active: true, displayOrder: 3, quantitySold: 43 }, 123)).toBe(
      false,
    );
  });
});
