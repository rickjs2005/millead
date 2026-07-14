// Helpers de formatação puros (sem dependência do @react-pdf/renderer).
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const fmtBRL = (v: number) => BRL.format(v);

export const fmtData = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);
