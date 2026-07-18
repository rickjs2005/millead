"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsService } from "@/services/settings";
import { useAuthStore } from "@/stores/auth-store";
import { formatDate, getInitials } from "@/utils/format";
import { cn } from "@/lib/utils";

export default function ProfileSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const dirty = name.trim() !== user.name && name.trim().length >= 2;

  async function saveName() {
    setSaving(true);
    try {
      const updated = await settingsService.updateProfile({ name: name.trim() });
      patchUser({ name: updated.name });
      toast.success("Nome atualizado.");
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Seu nome aparece na equipe e nas atividades do CRM.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
              <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-base font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">
                Membro desde {formatDate(user.createdAt)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>E-mail</Label>
              <Input value={user.email} disabled />
              <p className="text-xs text-muted-foreground">
                E-mail é sua identidade de login e não pode ser trocado por aqui.
              </p>
            </div>
          </div>
          <div>
            <Button onClick={saveName} disabled={!dirty || saving}>
              {saving ? "Salvando…" : "Salvar nome"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Escolha como o MilLead aparece para você.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-md grid-cols-3 gap-2">
            {[
              { value: "light", icon: Sun, label: "Claro" },
              { value: "dark", icon: Moon, label: "Escuro" },
              { value: "system", icon: Monitor, label: "Sistema" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border border-border py-4 text-sm text-muted-foreground transition-colors hover:bg-accent",
                  theme === opt.value && "border-primary bg-primary/5 text-primary",
                )}
              >
                <opt.icon className="h-5 w-5" />
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
