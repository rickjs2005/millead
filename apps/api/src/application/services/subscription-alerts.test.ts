import { describe, expect, it } from "vitest";
import {
  buildDedupeKey,
  buildDuplicateAlerts,
  buildScheduleAlerts,
  evaluateChargeAgainstSubscription,
  type AlertSubscription,
} from "./subscription-alerts.js";
import { formatUtcDate, utcDate } from "./vault-date.js";

const HOJE = utcDate(2026, 8, 20);

const sub = (over: Partial<AlertSubscription> = {}): AlertSubscription => ({
  id: "sub-claude",
  name: "Claude",
  merchantId: "m-claude",
  status: "ACTIVE",
  expectedCents: 12000,
  priceTolerancePct: 10,
  alertDaysBefore: 7,
  nextRenewalAt: utcDate(2026, 8, 21),
  ...over,
});

const tipos = (alerts: ReturnType<typeof buildScheduleAlerts>) => alerts.map((a) => a.type);

describe("alertas de renovação", () => {
  it("renova amanhã", () => {
    expect(tipos(buildScheduleAlerts([sub()], HOJE))).toEqual(["RENEWS_TOMORROW"]);
  });

  it("renova hoje", () => {
    expect(tipos(buildScheduleAlerts([sub({ nextRenewalAt: HOJE })], HOJE))).toEqual([
      "RENEWS_TODAY",
    ]);
  });

  it("renova em 3 e em 7 dias", () => {
    expect(
      tipos(buildScheduleAlerts([sub({ nextRenewalAt: utcDate(2026, 8, 23) })], HOJE)),
    ).toEqual(["RENEWS_IN_3_DAYS"]);
    expect(
      tipos(buildScheduleAlerts([sub({ nextRenewalAt: utcDate(2026, 8, 27) })], HOJE)),
    ).toEqual(["RENEWS_IN_7_DAYS"]);
  });

  it("dias que não são marco nenhum não geram alerta", () => {
    expect(buildScheduleAlerts([sub({ nextRenewalAt: utcDate(2026, 8, 25) })], HOJE)).toEqual([]);
  });

  it("respeita a antecedência configurada", () => {
    // Com antecedência de 1 dia, o aviso de 7 dias não interessa.
    const curto = sub({ alertDaysBefore: 1, nextRenewalAt: utcDate(2026, 8, 27) });
    expect(buildScheduleAlerts([curto], HOJE)).toEqual([]);
    expect(
      tipos(
        buildScheduleAlerts(
          [sub({ alertDaysBefore: 1, nextRenewalAt: utcDate(2026, 8, 21) })],
          HOJE,
        ),
      ),
    ).toEqual(["RENEWS_TOMORROW"]);
  });

  it("assinatura PAUSADA não gera alerta nenhum", () => {
    expect(buildScheduleAlerts([sub({ status: "PAUSED" })], HOJE)).toEqual([]);
  });

  it("assinatura CANCELADA não gera alerta nenhum", () => {
    expect(buildScheduleAlerts([sub({ status: "CANCELED" })], HOJE)).toEqual([]);
  });

  it("assinatura sem próxima renovação não gera alerta", () => {
    expect(buildScheduleAlerts([sub({ nextRenewalAt: null })], HOJE)).toEqual([]);
  });

  it("o alerta carrega o que a tela precisa mostrar", () => {
    const [alerta] = buildScheduleAlerts([sub()], HOJE);
    expect(alerta!.payload).toMatchObject({ name: "Claude", expectedAmount: "120.00" });
    expect(formatUtcDate(alerta!.referenceDate)).toBe("2026-08-21");
  });
});

describe("cobrança que não veio", () => {
  it("renovação vencida há dias vira MISSING_CHARGE", () => {
    const atrasada = sub({ nextRenewalAt: utcDate(2026, 8, 10) });
    expect(tipos(buildScheduleAlerts([atrasada], HOJE))).toEqual(["MISSING_CHARGE"]);
  });

  it("não acusa no dia seguinte — banco atrasa um ou dois dias", () => {
    // Alertar de imediato geraria falso positivo toda vez que a cobrança
    // caísse com um dia de atraso, e você pararia de ler os alertas.
    expect(buildScheduleAlerts([sub({ nextRenewalAt: utcDate(2026, 8, 19) })], HOJE)).toEqual([]);
  });
});

describe("assinatura possivelmente duplicada", () => {
  it("duas ativas do mesmo fornecedor com valor parecido", () => {
    const a = sub({ id: "sub-a" });
    const b = sub({ id: "sub-b", expectedCents: 12500 });
    const alertas = buildDuplicateAlerts([a, b], HOJE);

    expect(alertas).toHaveLength(1);
    expect(alertas[0]!.type).toBe("POSSIBLE_DUPLICATE");
  });

  it("gera UM alerta por par, não um por assinatura", () => {
    // Dois alertas dizendo a mesma coisa dobrariam o badge sem informação nova.
    const alertas = buildDuplicateAlerts([sub({ id: "sub-a" }), sub({ id: "sub-b" })], HOJE);
    expect(alertas).toHaveLength(1);
  });

  it("fornecedores diferentes não são duplicata", () => {
    const outro = sub({ id: "sub-b", merchantId: "m-openai", name: "OpenAI" });
    expect(buildDuplicateAlerts([sub(), outro], HOJE)).toEqual([]);
  });

  it("mesmo nome sem fornecedor também conta", () => {
    const a = sub({ id: "sub-a", merchantId: null });
    const b = sub({ id: "sub-b", merchantId: null });
    expect(buildDuplicateAlerts([a, b], HOJE)).toHaveLength(1);
  });

  it("valores muito diferentes não são duplicata", () => {
    const caro = sub({ id: "sub-b", expectedCents: 90000 });
    expect(buildDuplicateAlerts([sub(), caro], HOJE)).toEqual([]);
  });

  it("pausada não entra na comparação", () => {
    expect(
      buildDuplicateAlerts([sub({ id: "a" }), sub({ id: "b", status: "PAUSED" })], HOJE),
    ).toEqual([]);
  });
});

describe("variação de preço", () => {
  const cobranca = (cents: number) => ({
    id: "tx-1",
    date: utcDate(2026, 8, 21),
    amountCents: cents,
  });

  it("dentro da tolerância não alerta", () => {
    expect(evaluateChargeAgainstSubscription(sub(), cobranca(12500))).toBeNull();
  });

  it("acima da tolerância alerta", () => {
    const alerta = evaluateChargeAgainstSubscription(sub(), cobranca(15000));
    expect(alerta?.type).toBe("PRICE_CHANGED");
    expect(alerta?.payload).toMatchObject({ expectedAmount: "120.00", chargedAmount: "150.00" });
  });

  it("alerta também quando o valor CAI fora da tolerância", () => {
    // Queda grande costuma ser mudança de plano ou cobrança parcial — vale
    // saber tanto quanto um aumento.
    expect(evaluateChargeAgainstSubscription(sub(), cobranca(6000))?.type).toBe("PRICE_CHANGED");
  });

  it("tolerância zero alerta em qualquer diferença", () => {
    const rigida = sub({ priceTolerancePct: 0 });
    expect(evaluateChargeAgainstSubscription(rigida, cobranca(12001))?.type).toBe("PRICE_CHANGED");
    expect(evaluateChargeAgainstSubscription(rigida, cobranca(12000))).toBeNull();
  });
});

describe("buildDedupeKey", () => {
  it("é estável entre execuções", () => {
    const a = buildDedupeKey("RENEWS_TOMORROW", "sub-1", utcDate(2026, 8, 21));
    const b = buildDedupeKey("RENEWS_TOMORROW", "sub-1", utcDate(2026, 8, 21));
    expect(a).toBe(b);
  });

  it("muda com o tipo, com a âncora e com a data", () => {
    const base = buildDedupeKey("RENEWS_TOMORROW", "sub-1", utcDate(2026, 8, 21));
    expect(buildDedupeKey("RENEWS_TODAY", "sub-1", utcDate(2026, 8, 21))).not.toBe(base);
    expect(buildDedupeKey("RENEWS_TOMORROW", "sub-2", utcDate(2026, 8, 21))).not.toBe(base);
    expect(buildDedupeKey("RENEWS_TOMORROW", "sub-1", utcDate(2026, 8, 22))).not.toBe(base);
  });

  it("rodar a geração duas vezes produz as MESMAS chaves", () => {
    // É isso que torna a verificação a cada abertura do app idempotente.
    const primeira = buildScheduleAlerts([sub()], HOJE).map((a) => a.dedupeKey);
    const segunda = buildScheduleAlerts([sub()], HOJE).map((a) => a.dedupeKey);
    expect(primeira).toEqual(segunda);
  });
});
