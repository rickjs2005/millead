"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConvertEstimate } from "@/features/estimates/hooks";
import { formatCurrency } from "@/utils/format";
import type { EstimateComputed, PricingEstimate } from "@/types/api";

type PriceOption = "MIN" | "RECOMMENDED" | "PREMIUM" | "CUSTOM";

/** Mesmo preprocess vírgula-decimal do estimate-editor -- o dono digita
 * "5000,50" no campo Personalizado. */
function parseDecimal(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    return Number(trimmed.replace(",", "."));
  }
  return value;
}

const schema = z
  .object({
    option: z.enum(["MIN", "RECOMMENDED", "PREMIUM", "CUSTOM"]),
    customPrice: z.preprocess(
      parseDecimal,
      z
        .number({ invalid_type_error: "Informe um valor válido." })
        .min(1, "O valor personalizado deve ser de pelo menos R$ 1,00.")
        .optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.option === "CUSTOM" && (data.customPrice === undefined || Number.isNaN(data.customPrice))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customPrice"],
        message: "Informe um valor válido.",
      });
    }
  });
type FormValues = z.infer<typeof schema>;

/** Dialog de conversão orçamento -> proposta (Fase 3, Task 3). Recebe o
 * `computed` já calculado pelo editor (evita recalcular aqui) -- as 3 opções
 * de preço espelham `EstimateComputed.priceMin/priceRecommended/pricePremium`,
 * mais "Personalizado" pra fugir da faixa quando o combinado com o cliente
 * for outro. Sem lead vinculado o form nem aparece: só um estado explicativo
 * com o botão desabilitado (a API rejeita o convert sem leadId de qualquer
 * forma -- aqui é só pra não deixar o dono submeter e levar um erro de rede). */
export function ConvertEstimateDialog({
  estimate,
  computed,
  trigger,
}: {
  estimate: PricingEstimate;
  computed: EstimateComputed;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasLead = !!estimate.leadId;
  const convertEstimate = useConvertEstimate();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { option: "RECOMMENDED", customPrice: undefined },
  });

  const option = useWatch({ control, name: "option" });

  const priceOptions: { value: PriceOption; label: string; price: number }[] = [
    { value: "MIN", label: "Preço mínimo", price: computed.priceMin },
    { value: "RECOMMENDED", label: "Recomendado", price: computed.priceRecommended },
    { value: "PREMIUM", label: "Premium", price: computed.pricePremium },
  ];

  async function onSubmit(values: FormValues) {
    const price =
      values.option === "MIN"
        ? computed.priceMin
        : values.option === "PREMIUM"
          ? computed.pricePremium
          : values.option === "CUSTOM"
            ? (values.customPrice ?? 0)
            : computed.priceRecommended;

    const result = await convertEstimate.mutateAsync({ id: estimate.id, price });
    setOpen(false);
    window.open(result.pdfUrl, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar proposta</DialogTitle>
          <DialogDescription>
            Será criada uma proposta em rascunho com PDF para o cliente. Custos internos não
            aparecem no PDF.
          </DialogDescription>
        </DialogHeader>

        {!hasLead ? (
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              Este orçamento ainda não tem um lead vinculado. Vincule um lead em &quot;Dados
              gerais&quot; antes de gerar a proposta.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Fechar
              </Button>
              <Button type="button" disabled>
                Gerar proposta
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <Controller
              control={control}
              name="option"
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  {priceOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="convert-option"
                          value={opt.value}
                          checked={field.value === opt.value}
                          onChange={() => field.onChange(opt.value)}
                          className="h-4 w-4 accent-primary"
                        />
                        {opt.label}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(opt.price)}
                      </span>
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="convert-option"
                      value="CUSTOM"
                      checked={field.value === "CUSTOM"}
                      onChange={() => field.onChange("CUSTOM")}
                      className="h-4 w-4 accent-primary"
                    />
                    Personalizado
                  </label>
                </div>
              )}
            />

            {option === "CUSTOM" && (
              <div className="flex flex-col gap-1.5 pl-1">
                <Label htmlFor="convert-custom-price">Valor personalizado (R$)</Label>
                <Input id="convert-custom-price" inputMode="decimal" {...register("customPrice")} />
                {errors.customPrice && (
                  <p className="text-xs text-destructive">{errors.customPrice.message}</p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={convertEstimate.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={convertEstimate.isPending}>
                {convertEstimate.isPending ? "Gerando…" : "Gerar proposta"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
