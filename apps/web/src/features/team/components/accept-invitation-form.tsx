"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/services/api-client";
import { teamService } from "@/services/team";
import { useAuthStore } from "@/stores/auth-store";

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const preview = useQuery({
    queryKey: ["team", "invitation-preview", token],
    queryFn: () => teamService.previewInvitation(token),
    retry: false,
  });
  const accept = useMutation({
    mutationFn: () =>
      teamService.acceptInvitation({
        token,
        ...(preview.data?.existingAccount ? {} : { name: name.trim(), password }),
      }),
    onSuccess: (session) => {
      setSession(session);
      toast.success(`Você entrou na equipe ${session.organization.name}.`);
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : "Não foi possível aceitar o convite.",
      );
    },
  });

  if (preview.isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col gap-3 pt-6">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-20" />
          <Skeleton className="h-10" />
        </CardContent>
      </Card>
    );
  }

  if (preview.isError || !preview.data) {
    const message =
      preview.error instanceof ApiError
        ? preview.error.message
        : "Este convite não está disponível.";
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Convite indisponível</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" variant="outline" onClick={() => router.push("/login")}>
            Ir para o login
          </Button>
        </CardContent>
      </Card>
    );
  }

  const invitation = preview.data;
  const newAccountReady =
    invitation.existingAccount || (name.trim().length >= 2 && password.length >= 8);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserRoundCheck className="h-5 w-5" />
        </div>
        <CardTitle>Entrar em {invitation.organization.name}</CardTitle>
        <CardDescription>
          Convite para <strong>{invitation.email}</strong> como{" "}
          <strong>{invitation.role.name}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {invitation.existingAccount ? (
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            Sua conta já existe. Ao aceitar, este workspace será adicionado aos seus acessos.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-name">Seu nome</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-password">Crie uma senha</Label>
              <div className="relative">
                <Input
                  id="invite-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}
        <Button
          className="w-full"
          onClick={() => accept.mutate()}
          disabled={!newAccountReady || accept.isPending}
        >
          {accept.isPending ? "Aceitando…" : "Aceitar convite"}
        </Button>
      </CardContent>
    </Card>
  );
}
