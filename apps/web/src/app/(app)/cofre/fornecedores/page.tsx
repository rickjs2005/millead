"use client";

import { Plus, Store, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddVaultAlias,
  useCreateVaultMerchant,
  useRemoveVaultAlias,
  useVaultCategories,
  useVaultMerchants,
} from "@/features/vault/finance-hooks";

/**
 * Fornecedores e seus aliases bancários.
 *
 * O extrato escreve `ANTHROPIC`, `CLAUDE.AI`, `CLAUDE PRO` — todos são o
 * mesmo Claude. Cadastrar o alias uma vez resolve a classificação de todas as
 * cobranças futuras daquele fornecedor.
 */
export default function CofreFornecedoresPage() {
  const merchants = useVaultMerchants();
  const categories = useVaultCategories();
  const addAlias = useAddVaultAlias();
  const removeAlias = useRemoveVaultAlias();
  const [novoAlias, setNovoAlias] = useState<Record<string, string>>({});

  const nomeCategoria = (id: string | null) => {
    if (!id) return null;
    for (const root of categories.data ?? []) {
      if (root.id === id) return root.name;
      const child = root.children.find((c) => c.id === id);
      if (child) return `${root.name} / ${child.name}`;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <NovoFornecedorDialog />
      </div>

      {merchants.isPending && <Skeleton className="h-40 w-full" />}

      {!merchants.isPending && (merchants.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={Store}
          title="Nenhum fornecedor cadastrado"
          description="Cadastre os fornecedores que aparecem no seu extrato e os apelidos que o banco usa para cada um."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(merchants.data ?? []).map((merchant) => (
          <div key={merchant.id} className="space-y-2 rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">{merchant.name}</div>
              <div className="text-xs text-muted-foreground">
                {nomeCategoria(merchant.defaultCategoryId) ?? "Sem categoria padrão"}
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {merchant.aliases.map((alias) => (
                <Badge key={alias.id} variant="secondary" className="gap-1 font-mono text-[10px]">
                  {alias.alias}
                  <button
                    type="button"
                    aria-label={`Remover ${alias.alias}`}
                    onClick={() => removeAlias.mutate({ id: merchant.id, aliasId: alias.id })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {merchant.aliases.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhum apelido ainda.</span>
              )}
            </div>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const alias = (novoAlias[merchant.id] ?? "").trim();
                if (!alias) return;
                addAlias.mutate({ id: merchant.id, alias });
                setNovoAlias({ ...novoAlias, [merchant.id]: "" });
              }}
            >
              <Input
                value={novoAlias[merchant.id] ?? ""}
                onChange={(e) => setNovoAlias({ ...novoAlias, [merchant.id]: e.target.value })}
                placeholder="Como aparece no extrato"
                className="h-8 text-xs"
                aria-label={`Novo apelido para ${merchant.name}`}
              />
              <Button type="submit" size="sm" variant="outline" className="h-8">
                Add
              </Button>
            </form>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Os apelidos são normalizados (maiúsculas, sem acento) ao salvar. Um apelido só pode
        pertencer a um fornecedor — senão a classificação ficaria ambígua.
      </p>
    </div>
  );
}

function NovoFornecedorDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateVaultMerchant();
  const categories = useVaultCategories();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [aliases, setAliases] = useState("");

  async function submit() {
    await create.mutateAsync({
      name: name.trim(),
      defaultCategoryId: categoryId || null,
      aliases: aliases
        .split(/[\n,]/)
        .map((a) => a.trim())
        .filter(Boolean),
    });
    setOpen(false);
    setName("");
    setCategoryId("");
    setAliases("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Novo fornecedor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo fornecedor</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="forn-nome">Nome</Label>
            <Input
              id="forn-nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="forn-cat">Categoria padrão</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="forn-cat">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).flatMap((root) => [
                  <SelectItem key={root.id} value={root.id}>
                    {root.name}
                  </SelectItem>,
                  ...root.children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {root.name} / {child.name}
                    </SelectItem>
                  )),
                ])}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="forn-aliases">Como aparece no extrato</Label>
            <Input
              id="forn-aliases"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="ANTHROPIC, CLAUDE.AI, CLAUDE PRO"
            />
            <p className="text-[11px] text-muted-foreground">
              Separe por vírgula. Todos apontam para o mesmo fornecedor.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
