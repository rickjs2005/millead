"use client";

import { FileText, MessageSquare, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCard } from "@/features/messages/components/message-card";
import { TemplateFormDialog } from "@/features/messages/components/template-form-dialog";
import {
  useMessages,
  useMessageTemplates,
  useUpdateTemplate,
} from "@/features/messages/hooks";
import {
  MESSAGE_CHANNEL_LABELS,
  MESSAGE_STATUS_LABELS,
} from "@/features/messages/message-labels";
import type { MessageChannel, MessageStatus, MessageTemplate } from "@/types/api";

function MessagesTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<MessageStatus | "ALL">("ALL");
  const [channel, setChannel] = useState<MessageChannel | "ALL">("ALL");

  const { data, isLoading, isError, refetch } = useMessages({
    page,
    pageSize: 15,
    status: status === "ALL" ? undefined : status,
    channel: channel === "ALL" ? undefined : channel,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as MessageStatus | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {Object.entries(MESSAGE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={channel}
          onValueChange={(v) => {
            setChannel(v as MessageChannel | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os canais</SelectItem>
            {Object.entries(MESSAGE_CHANNEL_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhuma mensagem ainda"
          description="Os rascunhos são gerados na aba Mensagens de cada lead — abra um lead e clique em “Gerar mensagem”."
          className="py-20"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((message) => (
            <MessageCard key={message.id} message={message} showLead />
          ))}
        </div>
      )}

      {data && data.total > 0 && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function TemplateRow({ template }: { template: MessageTemplate }) {
  const updateTemplate = useUpdateTemplate();

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{template.name}</p>
            <Badge variant="outline">{MESSAGE_CHANNEL_LABELS[template.channel]}</Badge>
            {!template.isActive && <Badge variant="secondary">Inativo</Badge>}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.body}</p>
        </div>
        <Switch
          checked={template.isActive}
          disabled={updateTemplate.isPending}
          onCheckedChange={(checked) =>
            updateTemplate.mutate({ id: template.id, payload: { isActive: checked } })
          }
          title={template.isActive ? "Desativar modelo" : "Ativar modelo"}
        />
        <TemplateFormDialog
          key={template.updatedAt}
          template={template}
          trigger={
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

function TemplatesTab() {
  const { data: templates, isLoading, isError, refetch } = useMessageTemplates();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Modelos que a IA usa como ponto de partida ao gerar rascunhos.
        </p>
        <TemplateFormDialog
          trigger={
            <Button>
              <Plus /> Novo modelo
            </Button>
          }
        />
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum modelo ainda"
          description="Modelos são opcionais — a IA também escreve do zero. Crie um quando quiser padronizar a abordagem."
          className="py-20"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((template) => (
            <TemplateRow key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
        <p className="text-sm text-muted-foreground">
          Rascunhos gerados por IA, histórico de envios e modelos de mensagem.
        </p>
      </div>

      <Tabs defaultValue="messages">
        <TabsList>
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
          <TabsTrigger value="templates">Modelos</TabsTrigger>
        </TabsList>
        <TabsContent value="messages">
          <MessagesTab />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
