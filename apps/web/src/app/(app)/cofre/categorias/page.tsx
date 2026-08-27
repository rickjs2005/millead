"use client";

import { FolderTree, Plus } from "lucide-react";
import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  useCreateVaultCategory,
  useUpdateVaultCategory,
  useVaultCategories,
} from "@/features/vault/finance-hooks";

/**
 * Categorias e subcategorias — um nível só.
 *
 * Renomear é livre: a lógica do Cofre nunca procura categoria por nome (usa
 * `systemKey`), então "Transferências" pode virar o que você quiser sem
 * quebrar a regra de que transferência não é gasto.
 */
export default function CofreCategoriasPage() {
  const [incluirInativas, setIncluirInativas] = useState(false);
  const categories = useVaultCategories(incluirInativas);
  const update = useUpdateVaultCategory();
  const [editando, setEditando] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="cat-inativas"
            checked={incluirInativas}
            onCheckedChange={setIncluirInativas}
          />
          <Label htmlFor="cat-inativas" className="text-sm font-normal text-muted-foreground">
            Mostrar inativas
          </Label>
        </div>
        <NovaCategoriaDialog />
      </div>

      {categories.isPending && <Skeleton className="h-64 w-full" />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(categories.data ?? []).map((root) => (
          <div key={root.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              {editando?.id === root.id ? (
                <Input
                  autoFocus
                  value={editando.name}
                  onChange={(e) => setEditando({ id: root.id, name: e.target.value })}
                  onBlur={() => {
                    if (editando.name.trim() && editando.name !== root.name) {
                      update.mutate({ id: root.id, name: editando.name.trim() });
                    }
                    setEditando(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="h-7"
                />
              ) : (
                <button
                  type="button"
                  className="text-sm font-medium hover:underline"
                  onClick={() => setEditando({ id: root.id, name: root.name })}
                >
                  {root.name}
                </button>
              )}
              {!root.isActive && (
                <Badge variant="secondary" className="text-[10px]">
                  inativa
                </Badge>
              )}
            </div>

            {root.children.length > 0 && (
              <ul className="mt-2 space-y-1">
                {root.children.map((child) => (
                  <li
                    key={child.id}
                    className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
                  >
                    <span>{child.name}</span>
                    <Switch
                      checked={child.isActive}
                      aria-label={`Ativar ${child.name}`}
                      onCheckedChange={(isActive) => update.mutate({ id: child.id, isActive })}
                    />
                  </li>
                ))}
              </ul>
            )}

            {root.children.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Sem subcategorias.</p>
            )}
          </div>
        ))}
      </div>

      {!categories.isPending && (categories.data?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <FolderTree className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma categoria. As padrões nascem junto com o Cofre — se você chegou aqui sem elas,
            recarregue a página.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Clique no nome para renomear. Categoria em uso não é apagada, é desativada — apagar deixaria
        lançamentos antigos sem classificação e mudaria relatórios já fechados.
      </p>
    </div>
  );
}

function NovaCategoriaDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateVaultCategory();
  const categories = useVaultCategories();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");

  async function submit() {
    await create.mutateAsync({ name: name.trim(), parentId: parentId || null, color: null });
    setOpen(false);
    setName("");
    setParentId("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Nova categoria
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nova-cat">Nome</Label>
            <Input id="nova-cat" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nova-cat-mae">Categoria mãe</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger id="nova-cat-mae">
                <SelectValue placeholder="Nenhuma (categoria principal)" />
              </SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((root) => (
                  <SelectItem key={root.id} value={root.id}>
                    {root.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              A árvore tem um nível só — subcategoria não tem subcategoria.
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
