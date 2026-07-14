"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTemplate, useUpdateTemplate } from "@/features/messages/hooks";
import { MESSAGE_CHANNEL_LABELS } from "@/features/messages/message-labels";
import type { MessageChannel, MessageTemplate } from "@/types/api";

const schema = z.object({
  name: z.string().min(1, "Informe um nome."),
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS"]),
  subject: z.string().optional(),
  body: z.string().min(1, "Informe o texto do modelo."),
});
type FormValues = z.infer<typeof schema>;

/** Criar/editar modelo -- a IA usa o texto como ponto de partida do rascunho. */
export function TemplateFormDialog({
  template,
  trigger,
}: {
  template?: MessageTemplate;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const isEdit = !!template;
  const pending = createTemplate.isPending || updateTemplate.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: template?.name ?? "",
      channel: template?.channel ?? "WHATSAPP",
      subject: template?.subject ?? "",
      body: template?.body ?? "",
    },
  });
  const channel = watch("channel");

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      channel: values.channel,
      subject: values.channel === "EMAIL" && values.subject ? values.subject : undefined,
      body: values.body,
    };
    if (isEdit) {
      await updateTemplate.mutateAsync({ id: template.id, payload });
    } else {
      await createTemplate.mutateAsync(payload);
      reset();
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar modelo" : "Novo modelo"}</DialogTitle>
            <DialogDescription>
              A IA adapta o modelo com os dados de cada lead na hora de gerar o rascunho.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-name">Nome</Label>
                <Input id="template-name" placeholder="Ex.: Primeiro contato" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Canal</Label>
                <Controller
                  control={control}
                  name="channel"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as MessageChannel)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MESSAGE_CHANNEL_LABELS).map(([value, label]) => (
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
            {channel === "EMAIL" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template-subject">Assunto</Label>
                <Input id="template-subject" {...register("subject")} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template-body">Texto do modelo</Label>
              <Textarea
                id="template-body"
                rows={6}
                placeholder="Ex.: Oi! Vi que o site de vocês demora pra carregar e isso espanta cliente…"
                {...register("body")}
              />
              {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar modelo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
