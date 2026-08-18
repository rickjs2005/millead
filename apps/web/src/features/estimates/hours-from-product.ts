/**
 * Proporção de referência de um projeto web. É heurística, não verdade sobre
 * os nossos projetos -- serve de ponto de partida editável. Depois de alguns
 * orçamentos fechados, vale comparar com as horas realmente gastas e corrigir
 * estes números.
 */
const PROPORCAO = [
  { label: "Design", pct: 25 },
  { label: "Frontend", pct: 40 },
  { label: "Backend", pct: 20 },
  { label: "SEO", pct: 7 },
  { label: "Testes", pct: 8 },
] as const;

/** Etapas padrão de um orçamento, na ordem em que aparecem no formulário. */
export const ETAPAS_PADRAO: string[] = PROPORCAO.map((e) => e.label);

/** Índice da etapa mais gorda -- é nela que a sobra do arredondamento cai. */
const INDICE_MAIOR = PROPORCAO.reduce(
  (maior, etapa, i) => (etapa.pct > PROPORCAO[maior]!.pct ? i : maior),
  0,
);

/**
 * Distribui as horas-base do produto entre as etapas. A soma bate exatamente
 * com `baseHours`: arredondar cada etapa por conta própria perde (ou ganha)
 * hora, e hora perdida vira preço errado no fim.
 */
export function distribuirHoras(
  baseHours: number | null | undefined,
): { label: string; hours: number }[] {
  const base = Math.max(0, Math.round(baseHours ?? 0));
  const horas = PROPORCAO.map((etapa) => ({
    label: etapa.label as string,
    hours: base === 0 ? 0 : Math.round((base * etapa.pct) / 100),
  }));

  const sobra = base - horas.reduce((acc, h) => acc + h.hours, 0);
  if (sobra !== 0) {
    const alvo = horas[INDICE_MAIOR]!;
    alvo.hours = Math.max(0, alvo.hours + sobra);
  }
  return horas;
}
