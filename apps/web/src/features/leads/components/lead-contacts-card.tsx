"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAddLeadContact, useRemoveLeadContact } from "@/features/leads/hooks";
import type { LeadContact } from "@/types/api";

const schema = z.object({
  name: z.string().min(1, "Informe o nome."),
  role: z.string().optional(),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  phone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function LeadContactsCard({
  leadId,
  contacts,
}: {
  leadId: string;
  contacts: LeadContact[];
}) {
  const [open, setOpen] = useState(false);
  const addContact = useAddLeadContact(leadId);
  const removeContact = useRemoveLeadContact(leadId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    await addContact.mutateAsync({ ...values, email: values.email || undefined });
    reset();
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Contatos</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Novo contato</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contact-name">Nome</Label>
                  <Input id="contact-name" {...register("name")} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contact-role">Cargo</Label>
                  <Input id="contact-role" {...register("role")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contact-email">E-mail</Label>
                    <Input id="contact-email" type="email" {...register("email")} />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contact-phone">Telefone</Label>
                    <Input id="contact-phone" {...register("phone")} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={addContact.isPending}>
                  {addContact.isPending ? "Salvando…" : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <EmptyState icon={UserRound} title="Nenhum contato" className="border-none py-8" />
        ) : (
          <div className="flex flex-col gap-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">
                    {contact.name}
                    {contact.role && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        — {contact.role}
                      </span>
                    )}
                  </p>
                  {contact.email && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" /> {contact.email}
                    </p>
                  )}
                  {contact.phone && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {contact.phone}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeContact.mutate(contact.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
