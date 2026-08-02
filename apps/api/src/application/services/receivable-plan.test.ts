import { describe, expect, it } from "vitest";
import { buildPlan, type PlanInput } from "./receivable-plan.js";

const BASE: PlanInput = {
  total: 1000,
  entryAmount: 400,
  installmentCount: 3,
  firstDueDate: new Date(2026, 0, 31), // 31/01/2026
  entryDueDate: new Date(2026, 0, 5),
};

describe("buildPlan", () => {
  it("total 1000, entrada 400, 3x -> parcelas iguais de 200", () => {
    const plan = buildPlan(BASE);

    expect(plan).toHaveLength(4); // entrada + 3 parcelas
    expect(plan[0]).toMatchObject({ kind: "ENTRADA", installmentIndex: 0, amount: 400 });
    expect(plan[1]).toMatchObject({ kind: "PARCELA", installmentIndex: 1, amount: 200 });
    expect(plan[2]).toMatchObject({ kind: "PARCELA", installmentIndex: 2, amount: 200 });
    expect(plan[3]).toMatchObject({ kind: "PARCELA", installmentIndex: 3, amount: 200 });
  });

  it("total 1000, entrada 0, 3x -> 333.33/333.33/333.34 (resto na ultima)", () => {
    const plan = buildPlan({ ...BASE, entryAmount: 0, installmentCount: 3 });

    // entryAmount 0 nao gera item ENTRADA
    expect(plan).toHaveLength(3);
    expect(plan[0]).toMatchObject({ kind: "PARCELA", installmentIndex: 1, amount: 333.33 });
    expect(plan[1]).toMatchObject({ kind: "PARCELA", installmentIndex: 2, amount: 333.33 });
    expect(plan[2]).toMatchObject({ kind: "PARCELA", installmentIndex: 3, amount: 333.34 });
  });

  it.each([
    { total: 1000, entryAmount: 0, installmentCount: 3 },
    { total: 100, entryAmount: 0, installmentCount: 3 },
    { total: 10, entryAmount: 0, installmentCount: 7 },
    { total: 999.99, entryAmount: 333.33, installmentCount: 5 },
    { total: 2500.5, entryAmount: 1000.17, installmentCount: 4 },
  ])("soma das parcelas sempre === total (%j)", ({ total, entryAmount, installmentCount }) => {
    const plan = buildPlan({ ...BASE, total, entryAmount, installmentCount });
    const sum = plan.reduce((acc, item) => acc + item.amount, 0);
    expect(Math.round(sum * 100) / 100).toBeCloseTo(total, 2);
  });

  it("vencimentos mensais a partir de firstDueDate: 31/01 -> 28/02 -> 31/03 (clamp de dia curto)", () => {
    const plan = buildPlan(BASE);
    const parcelas = plan.filter((p) => p.kind === "PARCELA");

    expect(parcelas).toHaveLength(3);
    expect(parcelas[0]?.dueDate).toEqual(new Date(2026, 0, 31));
    expect(parcelas[1]?.dueDate).toEqual(new Date(2026, 1, 28)); // 2026 nao e bissexto
    expect(parcelas[2]?.dueDate).toEqual(new Date(2026, 2, 31));
  });

  it("lanca RangeError quando entrada > total", () => {
    expect(() => buildPlan({ ...BASE, entryAmount: 1500 })).toThrow(RangeError);
  });

  it("lanca RangeError quando N < 1 e ainda ha resto a parcelar", () => {
    expect(() => buildPlan({ ...BASE, entryAmount: 400, installmentCount: 0 })).toThrow(RangeError);
  });

  it("lanca RangeError quando total <= 0", () => {
    expect(() => buildPlan({ ...BASE, total: 0, entryAmount: 0 })).toThrow(RangeError);
    expect(() => buildPlan({ ...BASE, total: -10, entryAmount: 0 })).toThrow(RangeError);
  });

  it("lanca RangeError quando N < 0", () => {
    expect(() => buildPlan({ ...BASE, installmentCount: -1 })).toThrow(RangeError);
  });

  it("entrada === total com N=0 -> so item ENTRADA", () => {
    const plan = buildPlan({ ...BASE, entryAmount: 1000, installmentCount: 0 });

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: "ENTRADA", installmentIndex: 0, amount: 1000 });
  });
});
