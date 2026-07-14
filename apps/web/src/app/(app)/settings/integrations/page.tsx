import { Plug } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function IntegrationsSettingsPage() {
  return (
    <EmptyState
      icon={Plug}
      title="Integrações"
      description="WhatsApp, e-mail e outras integrações de mensageria chegam na Fase 7."
      comingSoon
    />
  );
}
