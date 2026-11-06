const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const formatEur = (v: number) => eur.format(v)
