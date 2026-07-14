"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyAuditCard } from "@/features/audit/components/company-audit-card";
import { LeadCompanyCard } from "@/features/leads/components/lead-company-card";
import { LeadMessagesTab } from "@/features/messages/components/lead-messages-tab";
import { LeadContactsCard } from "@/features/leads/components/lead-contacts-card";
import { LeadCrmTab } from "@/features/leads/components/lead-crm-tab";
import { LeadHeader } from "@/features/leads/components/lead-header";
import { LeadHistoryTab } from "@/features/leads/components/lead-history-tab";
import { LeadNotesTab } from "@/features/leads/components/lead-notes-tab";
import { LeadTagsCard } from "@/features/leads/components/lead-tags-card";
import { useCompany } from "@/features/companies/hooks";
import { useLead } from "@/features/leads/hooks";
import { ShieldCheck, FileStack } from "lucide-react";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: lead, isLoading } = useLead(id);
  const { data: company } = useCompany(lead?.companyId ?? undefined);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!lead) {
    return <EmptyState icon={ShieldCheck} title="Lead não encontrado" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <LeadHeader lead={lead} companyName={company?.name} />

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="notes">Observações</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
          <TabsTrigger value="files">Arquivos</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LeadCompanyCard companyId={lead.companyId} />
            <div className="flex flex-col gap-4">
              <LeadContactsCard leadId={lead.id} contacts={lead.contacts} />
              <LeadTagsCard leadId={lead.id} tags={lead.tags} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="crm">
          <LeadCrmTab leadId={lead.id} />
        </TabsContent>

        <TabsContent value="history">
          <LeadHistoryTab leadId={lead.id} />
        </TabsContent>

        <TabsContent value="notes">
          <LeadNotesTab leadId={lead.id} notes={lead.notes} />
        </TabsContent>

        <TabsContent value="audit">
          {lead.companyId ? (
            <CompanyAuditCard
              companyId={lead.companyId}
              hasWebsite={(company?.websites.length ?? 0) > 0}
            />
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="Auditoria de site"
              description="Vincule uma empresa (com site cadastrado) a este lead pra auditar o site dela."
            />
          )}
        </TabsContent>

        <TabsContent value="messages">
          <LeadMessagesTab leadId={lead.id} />
        </TabsContent>

        <TabsContent value="files">
          <EmptyState
            icon={FileStack}
            title="Arquivos"
            description="Upload de documentos e anexos deste lead."
            comingSoon
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
