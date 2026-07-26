import { describe, expect, it } from "vitest";
import type { BriefingDetail } from "@/types/api";
import { briefingToPrefill } from "./briefing-prefill";

type Field = { id: string; key: string; label: string; type: string };
type Answer = { fieldId: string; valueText?: string | null; valueJson?: unknown };

/** Fixture mínima: o prefill só lê template.sections[].fields e answers. */
function briefing(fields: Field[], answers: Answer[]): BriefingDetail {
  return {
    template: { sections: [{ fields }] },
    answers: answers.map((a) => ({
      fieldId: a.fieldId,
      valueText: a.valueText ?? null,
      valueJson: a.valueJson ?? null,
    })),
  } as unknown as BriefingDetail;
}

describe("briefingToPrefill", () => {
  it("mapeia as keys canônicas do template do seed", () => {
    const prefill = briefingToPrefill(
      briefing(
        [
          { id: "1", key: "empresa", label: "Empresa", type: "TEXT" },
          { id: "2", key: "descricao", label: "Descrição", type: "TEXTAREA" },
          { id: "3", key: "publico", label: "Público", type: "TEXT" },
          { id: "4", key: "diferenciais", label: "Diferenciais", type: "TEXTAREA" },
        ],
        [
          { fieldId: "1", valueText: "Padaria São Jorge" },
          { fieldId: "2", valueText: "Pães de fermentação natural" },
          { fieldId: "3", valueText: "famílias do bairro" },
          { fieldId: "4", valueText: "fermentação de 48h" },
        ],
      ),
    );

    expect(prefill.businessName).toBe("Padaria São Jorge");
    expect(prefill.description).toBe("Pães de fermentação natural");
    expect(prefill.audience).toBe("famílias do bairro");
    expect(prefill.differentials).toBe("fermentação de 48h");
    expect(prefill.notes).toBeUndefined();
  });

  it("junta cidade e estado em localização, e os contatos em uma linha", () => {
    const prefill = briefingToPrefill(
      briefing(
        [
          { id: "1", key: "cidade", label: "Cidade", type: "TEXT" },
          { id: "2", key: "estado", label: "Estado", type: "TEXT" },
          { id: "3", key: "whatsapp", label: "WhatsApp", type: "TEXT" },
          { id: "4", key: "email", label: "E-mail", type: "TEXT" },
        ],
        [
          { fieldId: "1", valueText: "Niterói" },
          { fieldId: "2", valueText: "RJ" },
          { fieldId: "3", valueText: "(21) 99999-0000" },
          { fieldId: "4", valueText: "contato@padaria.com" },
        ],
      ),
    );

    expect(prefill.location).toBe("Niterói / RJ");
    expect(prefill.contact).toBe("(21) 99999-0000 · contato@padaria.com");
  });

  it("captura os campos novos: concorrentes e ticket médio", () => {
    const prefill = briefingToPrefill(
      briefing(
        [
          { id: "1", key: "concorrentes_diretos", label: "Concorrentes", type: "TEXT" },
          { id: "2", key: "ticket_medio", label: "Ticket médio", type: "TEXT" },
          { id: "3", key: "segmento", label: "Segmento", type: "TEXT" },
        ],
        [
          { fieldId: "1", valueText: "Empório do Pão" },
          { fieldId: "2", valueText: "R$ 60" },
          { fieldId: "3", valueText: "padaria artesanal" },
        ],
      ),
    );

    expect(prefill.competitors).toBe("Empório do Pão");
    expect(prefill.averageTicket).toBe("R$ 60");
    expect(prefill.segment).toBe("padaria artesanal");
  });

  it("ignora arquivos e manda o resto pras observações, sem perder resposta", () => {
    const prefill = briefingToPrefill(
      briefing(
        [
          { id: "1", key: "logo", label: "Logo", type: "FILE" },
          { id: "2", key: "horario_de_atendimento", label: "Horário", type: "TEXT" },
        ],
        [
          { fieldId: "1", valueText: "https://blob/logo.png" },
          { fieldId: "2", valueText: "7h às 19h" },
        ],
      ),
    );

    expect(prefill.notes).toContain("Horário: 7h às 19h");
    expect(prefill.notes).not.toContain("logo.png");
  });

  it("aceita resposta em array (checkbox) e deduplica valores repetidos de grupo", () => {
    const prefill = briefingToPrefill(
      briefing(
        [{ id: "1", key: "servicos_oferecidos", label: "Serviços", type: "CHECKBOX" }],
        [
          { fieldId: "1", valueJson: ["pães", "bolos"] },
          { fieldId: "1", valueJson: ["pães", "bolos"] },
        ],
      ),
    );

    expect(prefill.description).toBe("pães, bolos");
  });

  it("ignora resposta de campo que não existe mais no template", () => {
    const prefill = briefingToPrefill(
      briefing(
        [{ id: "1", key: "empresa", label: "Empresa", type: "TEXT" }],
        [{ fieldId: "999", valueText: "órfã" }],
      ),
    );

    expect(prefill.businessName).toBeUndefined();
    expect(prefill.notes).toBeUndefined();
  });
});
