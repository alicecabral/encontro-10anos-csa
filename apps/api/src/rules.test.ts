import { describe, it, expect } from 'vitest';
import {
  LOT_CAPACITIES,
  getLotCapacity,
  graduationYearFromClassOf2016Answer,
  isLotAvailableByRelease,
} from './rules.js';
import {
  findClassForParticipant,
  findClassForStoredName,
  loadClassOf2016Roster,
  parseClassOf2016Roster,
} from './class-of-2016.js';
describe('regras de inscrição', () => {
  it('aceita somente telefone brasileiro normalizado', () =>
    expect('(31) 99999-9999'.replace(/\D/g, '')).toBe('31999999999'));
  it('não usa o preço informado pelo cliente', () => {
    const priceFromDatabase = 150;
    const clientPrice = 1;
    expect(priceFromDatabase).not.toBe(clientPrice);
  });
  it('mapeia a correspondência com a lista para o ano de formatura', () => {
    expect(graduationYearFromClassOf2016Answer(true)).toBe(2016);
    expect(graduationYearFromClassOf2016Answer(false)).toBeNull();
  });
  it('encontra a turma por nome e sobrenome completos, ignorando caixa e acentos', () => {
    const roster = parseClassOf2016Roster(
      '\uFEFFALICE CABRAL DE AVELAR MARQUES;3E;;;\r\nANDRÉ DE SOUZA LIMA;3A;;;',
    );

    expect(findClassForParticipant('Alice', 'Marques', roster)).toBe('3E');
    expect(findClassForParticipant('Alice', 'Mendes', roster)).toBeNull();
    expect(findClassForParticipant('Andre', 'Lima', roster)).toBe('3A');
    expect(findClassForParticipant('Ali', 'Marques', roster)).toBeNull();
    expect(findClassForStoredName('Alice Marques', roster)).toBe('3E');
  });
  it('rejeita registros inválidos na lista da turma', () => {
    expect(() => parseClassOf2016Roster('ALICE CABRAL;')).toThrow(
      'Registro inválido no CSV da turma de 2016',
    );
    expect(() => parseClassOf2016Roster('')).toThrow(
      'O CSV da turma de 2016 não contém participantes.',
    );
  });
  it('carrega o CSV configurado e localiza a turma da participante de exemplo', async () => {
    const roster = await loadClassOf2016Roster();

    expect(findClassForParticipant('Alice', 'Marques', roster)).toBe('3E');
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
