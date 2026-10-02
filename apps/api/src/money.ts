export const lotPrices = [200, 220, 240];

export function formatMoneyBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
