import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SnapshotSchema } from "@millead/video-contracts";
import { describe, expect, it } from "vitest";
import { sectionsFromSnapshot } from "./from-snapshot";
import { matchTemplate } from "./match-template";
import { templateById } from "./templates";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "testing", "snapshot-milweb.json");
const snapshot = SnapshotSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf8")));
const secoes = sectionsFromSnapshot(snapshot);

describe("matchTemplate", () => {
  it("casa o hero do template com a seção top do site", () => {
    const { scenes } = matchTemplate(templateById("institucional")!, secoes);
    const site = scenes.filter((s) => s.kind === "site");
    expect(site.map((s) => s.sectionId)).toContain("top");
  });

  it("casa contato com a seção contact", () => {
    const { scenes } = matchTemplate(templateById("institucional")!, secoes);
    expect(scenes.map((s) => s.sectionId)).toContain("contact");
  });

  it("relata o que o template pediu e o site não tem", () => {
    const { naoEncontrados } = matchTemplate(templateById("portfolio")!, secoes);
    // A fixture tem 4 seções; um template de portfólio pede mais que isso.
    expect(naoEncontrados.length).toBeGreaterThan(0);
    expect(naoEncontrados.every((n) => typeof n === "string" && n.length > 0)).toBe(true);
  });

  it("nunca inventa seção que não existe no site", () => {
    const { scenes } = matchTemplate(templateById("portfolio")!, secoes);
    const idsReais = new Set(secoes.map((s) => s.sectionId));
    for (const cena of scenes.filter((s) => s.kind === "site")) {
      expect(idsReais.has(cena.sectionId!)).toBe(true);
    }
  });

  it("mantém as cenas de estúdio, que não dependem do site", () => {
    const { scenes } = matchTemplate(templateById("institucional")!, secoes);
    expect(scenes.some((s) => s.kind === "studio" && s.component === "whatsapp")).toBe(true);
  });

  it("não usa a mesma seção em duas cenas", () => {
    const { scenes } = matchTemplate(templateById("institucional")!, secoes);
    const usados = scenes.filter((s) => s.kind === "site").map((s) => s.sectionId);
    expect(new Set(usados).size).toBe(usados.length);
  });

  it("prefere casar pelo id da seção, não pela prosa do título", () => {
    // A seção `contact` do milweb tem o título "Pronto para transformar sua
    // ideia em um produto digital?" -- a palavra "produt" aparece na prosa.
    // Sem a preferência por id, um want de "Produtos" roubaria a seção de
    // contato e o want de "Contato" ficaria órfão com a seção existindo.
    const { scenes, naoEncontrados } = matchTemplate(templateById("loja")!, secoes);
    const contato = scenes.find((s) => s.sectionId === "contact");
    expect(contato).toBeTruthy();
    expect(naoEncontrados).not.toContain("Contato");
  });

  it("ainda casa pelo título quando o id não diz nada", () => {
    const secoesFalsas = [
      {
        nodeId: "n1",
        sectionId: "bloco-1",
        label: "Sobre a nossa história",
        screenshot: null,
        box: { x: 0, y: 0, w: 1920, h: 600 },
      },
    ];
    const { scenes } = matchTemplate(templateById("institucional")!, secoesFalsas);
    expect(scenes.some((s) => s.sectionId === "bloco-1")).toBe(true);
  });
});
