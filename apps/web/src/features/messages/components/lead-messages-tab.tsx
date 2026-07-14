"use client";

import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerateMessageDialog } from "@/features/messages/components/generate-message-dialog";
import { MessageCard } from "@/features/messages/components/message-card";
import { useMessages } from "@/features/messages/hooks";

export function LeadMessagesTab({ leadId }: { leadId: string }) {
  const { data, isLoading, isError, refetch } = useMessages({ leadId, pageSize: 20 });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Rascunhos gerados por IA e histórico de mensagens deste lead.
        </p>
        <GenerateMessageDialog leadId={leadId} />
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhuma mensagem ainda"
          description="Gere o primeiro rascunho com IA — ele fica salvo aqui pra você revisar, copiar e enviar."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}
        </div>
      )}
    </div>
  );
}
