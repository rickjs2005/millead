"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAddCompanyWebsite, useRemoveCompanyWebsite } from "@/features/companies/hooks";
import type { CompanyWebsite } from "@/types/api";

const schema = z.object({
  url: z.string().url("Informe uma URL válida (com https://)."),
  isPrimary: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CompanyWebsitesCard({
  companyId,
  websites,
}: {
  companyId: string;
  websites: CompanyWebsite[];
}) {
  const [open, setOpen] = useState(false);
  const addWebsite = useAddCompanyWebsite(companyId);
  const removeWebsite = useRemoveCompanyWebsite(companyId);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { url: "", isPrimary: false },
  });

  async function onSubmit(values: FormValues) {
    await addWebsite.mutateAsync(values);
    reset();
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Sites</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Novo site</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="website-url">URL</Label>
                  <Input id="website-url" placeholder="https://…" {...register("url")} />
                  {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name="isPrimary"
                    render={({ field }) => (
                      <Checkbox
                        id="website-primary"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    )}
                  />
                  <Label htmlFor="website-primary" className="font-normal">
                    Site principal
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={addWebsite.isPending}>
                  {addWebsite.isPending ? "Salvando…" : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {websites.length === 0 ? (
          <EmptyState icon={Globe} title="Nenhum site cadastrado" className="border-none py-8" />
        ) : (
          <div className="flex flex-col gap-2">
            {websites.map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{site.url}</span>
                  </a>
                  {site.isPrimary && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="h-3 w-3" /> Principal
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeWebsite.mutate(site.id)}
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
