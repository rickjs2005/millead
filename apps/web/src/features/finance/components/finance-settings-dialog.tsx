"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCostSummary, useFinanceSettings, useUpdateFinanceSettings } from "@/features/finance/hooks";

const schema = z.object({
  usdToBrlRate: z.coerce
    .number()
    .min(0.01, "Informe um câmbio válido.")
    .max(1000, "Use um valor entre 0,01 e 1000."),
  defaultHourlyRate: z.coerce
    .number()
    .min(0, "Informe um valor válido.")
    .max(9_999_999, "Use um valor até 9.999.999."),
  supportReservePct: z.coerce
    .number()
    .min(0, "Use um valor entre 0 e 100.")
    .max(100, "Use um valor entre 0 e 100."),
  defaultMarginPct: z.coerce
    .number()
    .min(0, "Use um valor entre 0 e 500.")
    .max(500, "Use um valor entre 0 e 500."),
  activeClientsCount: z.coerce
    .number()
    .int()
    .min(1, "Informe ao menos 1 cliente ativo.")
    .max(10_000, "Use um valor até 10.000."),
});
type FormValues = z.infer<typeof schema>;

/** `values` (em vez de `defaultValues`) mantém o form ressincronizado sempre
 * que useFinanceSettings() resolver -- na primeira renderização os settings
 * ainda não chegaram da API, e usar defaultValues fixaria o form vazio. */
export function FinanceSettingsDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: settings } = useFinanceSettings();
  const { data: summary } = useCostSummary();
  const updateFinanceSettings = useUpdateFinanceSettings();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: settings
      ? {
          usdToBrlRate: Number(settings.usdToBrlRate),
          defaultHourlyRate: Number(settings.defaultHourlyRate),
          supportReservePct: Number(settings.supportReservePct),
          defaultMarginPct: Number(settings.defaultMarginPct),
          activeClientsCount: settings.activeClientsCount,
        }
      : undefined,
  });

  async function onSubmit(values: FormValues) {
    await updateFinanceSettings.mutateAsync(values);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Configurações financeiras</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-usd-rate">Câmbio USD → BRL</Label>
              <Input id="settings-usd-rate" inputMode="decimal" {...register("usdToBrlRate")} />
              <p className="text-xs text-muted-foreground">
                Use um valor com folga pra IOF/spread — hoje US$ 1 ≈ R$ 5,07.
              </p>
              {errors.usdToBrlRate && (
                <p className="text-xs text-destructive">{errors.usdToBrlRate.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-hourly-rate">Valor/hora padrão (R$)</Label>
                <Input
                  id="settings-hourly-rate"
                  inputMode="decimal"
                  {...register("defaultHourlyRate")}
                />
                {errors.defaultHourlyRate && (
                  <p className="text-xs text-destructive">{errors.defaultHourlyRate.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-active-clients">Clientes ativos</Label>
                <Input
                  id="settings-active-clients"
                  type="number"
                  min={1}
                  {...register("activeClientsCount")}
                />
                <p className="text-xs text-muted-foreground">
                  Sugestão: {summary?.wonLeadsCount ?? 0} lead{summary?.wonLeadsCount === 1 ? "" : "s"} ganho
                  {summary?.wonLeadsCount === 1 ? "" : "s"}.
                </p>
                {errors.activeClientsCount && (
                  <p className="text-xs text-destructive">{errors.activeClientsCount.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-support-reserve">Reserva de suporte (%)</Label>
                <Input
                  id="settings-support-reserve"
                  inputMode="decimal"
                  {...register("supportReservePct")}
                />
                {errors.supportReservePct && (
                  <p className="text-xs text-destructive">{errors.supportReservePct.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-default-margin">Margem padrão (%)</Label>
                <Input
                  id="settings-default-margin"
                  inputMode="decimal"
                  {...register("defaultMarginPct")}
                />
                {errors.defaultMarginPct && (
                  <p className="text-xs text-destructive">{errors.defaultMarginPct.message}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateFinanceSettings.isPending || !settings}>
              {updateFinanceSettings.isPending ? "Salvando…" : "Salvar configurações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
