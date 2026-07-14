"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOCIAL_PLATFORM_LABELS } from "@/features/companies/company-labels";
import { useAddCompanySocial, useRemoveCompanySocial } from "@/features/companies/hooks";
import type { CompanySocial, SocialPlatform } from "@/types/api";

const schema = z.object({
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "WHATSAPP", "OTHER"]),
  handleOrUrl: z.string().min(1, "Informe o @ ou a URL do perfil."),
});
type FormValues = z.infer<typeof schema>;

export function CompanySocialsCard({
  companyId,
  socials,
}: {
  companyId: string;
  socials: CompanySocial[];
}) {
  const [open, setOpen] = useState(false);
  const addSocial = useAddCompanySocial(companyId);
  const removeSocial = useRemoveCompanySocial(companyId);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { platform: "INSTAGRAM", handleOrUrl: "" },
  });

  async function onSubmit(values: FormValues) {
    await addSocial.mutateAsync(values);
    reset();
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Redes sociais</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Nova rede social</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Plataforma</Label>
                  <Controller
                    control={control}
                    name="platform"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(v) => field.onChange(v as SocialPlatform)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SOCIAL_PLATFORM_LABELS).map(([value, label]) => (
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
                  <Label htmlFor="social-handle">@ ou URL do perfil</Label>
                  <Input id="social-handle" placeholder="@empresa" {...register("handleOrUrl")} />
                  {errors.handleOrUrl && (
                    <p className="text-xs text-destructive">{errors.handleOrUrl.message}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={addSocial.isPending}>
                  {addSocial.isPending ? "Salvando…" : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {socials.length === 0 ? (
          <EmptyState
            icon={AtSign}
            title="Nenhuma rede social cadastrada"
            className="border-none py-8"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {socials.map((social) => (
              <div
                key={social.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="secondary">{SOCIAL_PLATFORM_LABELS[social.platform]}</Badge>
                  <span className="truncate text-sm">{social.handleOrUrl}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeSocial.mutate(social.id)}
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
