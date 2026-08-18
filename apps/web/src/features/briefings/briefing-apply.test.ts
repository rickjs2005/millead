import { describe, expect, it } from "vitest";
import { deveAplicarBriefing } from "./briefing-apply";

describe("deveAplicarBriefing", () => {
  it("aplica quando o detalhe carregado é o do briefing escolhido", () => {
    expect(deveAplicarBriefing({ detailId: "b-1", briefingId: "b-1", jaAplicadoId: null })).toBe(
      true,
    );
  });

  // O bug: sem esta trava, cada re-render reaplicava o briefing e apagava o
  // que o dono tinha acabado de digitar no escopo.
  it("NÃO reaplica o mesmo briefing -- é o que quebra o laço", () => {
    expect(deveAplicarBriefing({ detailId: "b-1", briefingId: "b-1", jaAplicadoId: "b-1" })).toBe(
      false,
    );
  });

  it("trocar de briefing aplica o novo", () => {
    expect(deveAplicarBriefing({ detailId: "b-2", briefingId: "b-2", jaAplicadoId: "b-1" })).toBe(
      true,
    );
  });

  it("resposta atrasada de uma seleção anterior é ignorada", () => {
    expect(deveAplicarBriefing({ detailId: "b-1", briefingId: "b-2", jaAplicadoId: null })).toBe(
      false,
    );
  });

  it("sem detalhe carregado ainda, não aplica", () => {
    expect(
      deveAplicarBriefing({ detailId: undefined, briefingId: "b-1", jaAplicadoId: null }),
    ).toBe(false);
  });

  it("sem briefing escolhido, não aplica", () => {
    expect(
      deveAplicarBriefing({ detailId: "b-1", briefingId: undefined, jaAplicadoId: null }),
    ).toBe(false);
  });
});
