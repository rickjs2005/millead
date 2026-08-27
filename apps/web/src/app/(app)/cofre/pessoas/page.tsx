"use client";

import { Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateVaultContact,
  useDeleteVaultContact,
  useUpdateVaultContact,
  useVaultContacts,
} from "@/features/vault/debt-hooks";

/**
 * Pessoas envolvidas nas dívidas.
 *
 * O campo de contato é texto livre — apelido, telefone, o que ajudar a
 * lembrar. Não existe campo de CPF, conta ou chave Pix, e isso é de propósito:
 * o Cofre não guarda credencial de ninguém. Um dado de terceiro vazado é pior
 * que um dado próprio vazado, porque a pessoa nem sabia que ele estava aqui.
 */
export default function CofrePessoasPage() {
  const [incluirInativas, setIncluirInativas] = useState(false);
  const contacts = useVaultContacts(incluirInativas);
  const update = useUpdateVaultContact();
  const remove = useDeleteVaultContact();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setIncluirInativas((v) => !v)}>
          {incluirInativas ? "Ocultar inativas" : "Mostrar inativas"}
        </Button>
        <NovaPessoaDialog />
      </div>

      {contacts.isPending && <Skeleton className="h-32 w-full" />}

      {!contacts.isPending && (contacts.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhuma pessoa cadastrada"
          description="Cadastre quem entra nas suas dívidas — quem te deve e para quem você deve."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(contacts.data ?? []).map((pessoa) => (
          <div key={pessoa.id} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{pessoa.name}</span>
                  {!pessoa.isActive && (
                    <Badge variant="outline" className="text-[10px]">
                      Inativa
                    </Badge>
                  )}
                </div>
                {pessoa.contact && (
                  <div className="truncate text-xs text-muted-foreground">{pessoa.contact}</div>
                )}
                {pessoa.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">{pessoa.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update.mutate({ id: pessoa.id, isActive: !pessoa.isActive })}
                >
                  {pessoa.isActive ? "Desativar" : "Reativar"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${pessoa.name}`}
                  onClick={() => remove.mutate(pessoa.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Pessoa com dívida registrada não pode ser apagada — desative para tirá-la das listas sem
        perder o histórico.
      </p>
    </div>
  );
}

function NovaPessoaDialog() {
  const [aberto, setAberto] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const create = useCreateVaultContact();

  const salvar = () => {
    create.mutate(
      { name: name.trim(), contact: contact.trim() || null, notes: notes.trim() || null },
      {
        onSuccess: () => {
          setAberto(false);
          setName("");
          setContact("");
          setNotes("");
        },
      },
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova pessoa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pessoa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pessoa-nome">Nome</Label>
            <Input
              id="pessoa-nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bruno"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pessoa-contato">Contato</Label>
            <Input
              id="pessoa-contato"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Telefone, apelido, como você lembra dela"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pessoa-notas">Observações</Label>
            <Textarea
              id="pessoa-notas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={!name.trim() || create.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
