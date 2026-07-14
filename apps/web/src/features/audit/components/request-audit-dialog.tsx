"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { CompanyCombobox } from "@/features/companies/components/company-combobox";
import { useRequestAudit } from "@/features/audit/hooks";

export function RequestAuditDialog() {
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | undefined>();
  const requestAudit = useRequestAudit();

  async function handleSubmit() {
    if (!companyId) return;
    await requestAudit.mutateAsync(companyId);
    setCompanyId(undefined);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ShieldCheck /> Nova auditoria
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Auditar site de empresa</DialogTitle>
          <DialogDescription>
            O site principal da empresa será analisado em performance, SEO, acessibilidade,
            segurança, mobile e design. A empresa precisa ter um site cadastrado.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-2">
          <Label>Empresa</Label>
          <CompanyCombobox value={companyId} onChange={(id) => setCompanyId(id)} />
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!companyId || requestAudit.isPending}>
            {requestAudit.isPending ? "Enfileirando…" : "Auditar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
