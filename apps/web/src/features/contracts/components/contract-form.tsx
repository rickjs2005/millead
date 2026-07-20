"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTRACT_PAYMENT_LABELS,
  CONTRACT_TYPE_LABELS,
} from "@/features/contracts/contract-labels";
import type { CreateContractPayload } from "@/services/contracts";

const schema = z.object({
  tipoPessoa: z.enum(["PF", "PJ"]),
  nome: z.string().min(2, "Informe o nome completo."),
  documento: z
    .string()
    .refine(
      (v) => [11, 14].includes(v.replace(/\D/g, "").length),
      "CPF (11) ou CNPJ (14 dígitos).",
    ),
  email: z.string().email("E-mail inválido."),
  telefone: z.string().min(8, "Informe um telefone válido."),
  endereco: z.string().min(5, "Informe o endereço completo."),
  nomeEmpresa: z.string().optional(),
  tipo: z.enum(["SITE", "SISTEMA", "SAAS", "MANUTENCAO", "CONSULTORIA"]),
  descricaoProjeto: z.string().min(10, "Descreva o projeto (mínimo 10 caracteres)."),
  valorTotal: z.coerce.number().positive("Informe o valor total."),
  formaPagamento: z.enum(["PIX", "BOLETO", "CARTAO", "TRANSFERENCIA", "PARCELADO"]),
  percentualEntrada: z.coerce.number().min(0).max(100),
  prazoEntregaDias: z.coerce.number().int().min(1, "Mínimo 1 dia.").max(365),
});
type FormValues = z.infer<typeof schema>;

const err = (m?: string) => m && <p className="text-xs text-destructive">{m}</p>;

/** Formulário de fechamento -- usado no painel e na página pública. */
export function ContractForm({
  onSubmit,
  pending,
  submitLabel,
}: {
  onSubmit: (values: CreateContractPayload) => Promise<void>;
  pending: boolean;
  submitLabel: string;
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipoPessoa: "PJ",
      tipo: "SITE",
      formaPagamento: "PIX",
      percentualEntrada: 50,
      prazoEntregaDias: 30,
    },
  });
  const tipoPessoa = watch("tipoPessoa");

  async function submit(values: FormValues) {
    await onSubmit({
      ...values,
      documento: values.documento.replace(/\D/g, ""),
      nomeEmpresa: values.nomeEmpresa?.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Dados do contratante</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <Controller
              control={control}
              name="tipoPessoa"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PJ">Pessoa Jurídica (empresa)</SelectItem>
                    <SelectItem value="PF">Pessoa Física</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-documento">{tipoPessoa === "PJ" ? "CNPJ" : "CPF"}</Label>
            <Input id="ct-documento" placeholder="Só números" {...register("documento")} />
            {err(errors.documento?.message)}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ct-nome">
            {tipoPessoa === "PJ" ? "Nome do responsável" : "Nome completo"}
          </Label>
          <Input id="ct-nome" {...register("nome")} />
          {err(errors.nome?.message)}
        </div>
        {tipoPessoa === "PJ" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-empresa">Razão social / nome da empresa</Label>
            <Input id="ct-empresa" {...register("nomeEmpresa")} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-email">E-mail</Label>
            <Input id="ct-email" type="email" {...register("email")} />
            {err(errors.email?.message)}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-telefone">Telefone/WhatsApp</Label>
            <Input id="ct-telefone" placeholder="(11) 99999-9999" {...register("telefone")} />
            {err(errors.telefone?.message)}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ct-endereco">Endereço completo</Label>
          <Input
            id="ct-endereco"
            placeholder="Rua, número, bairro, cidade - UF"
            {...register("endereco")}
          />
          {err(errors.endereco?.message)}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Projeto e condições</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo de serviço</Label>
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Forma de pagamento</Label>
            <Controller
              control={control}
              name="formaPagamento"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACT_PAYMENT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ct-descricao">Descrição do projeto</Label>
          <Textarea
            id="ct-descricao"
            rows={4}
            placeholder="O que será entregue, páginas/funcionalidades, referências…"
            {...register("descricaoProjeto")}
          />
          {err(errors.descricaoProjeto?.message)}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-valor">Valor total (R$)</Label>
            <Input id="ct-valor" type="number" step="0.01" min="0" {...register("valorTotal")} />
            {err(errors.valorTotal?.message)}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-entrada">Entrada (%)</Label>
            <Input
              id="ct-entrada"
              type="number"
              min="0"
              max="100"
              {...register("percentualEntrada")}
            />
            {err(errors.percentualEntrada?.message)}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-prazo">Prazo (dias)</Label>
            <Input
              id="ct-prazo"
              type="number"
              min="1"
              max="365"
              {...register("prazoEntregaDias")}
            />
            {err(errors.prazoEntregaDias?.message)}
          </div>
          <div className="flex flex-col justify-end">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Enviando…" : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
