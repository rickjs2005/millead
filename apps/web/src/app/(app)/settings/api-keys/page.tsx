import { Key } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function ApiKeysSettingsPage() {
  return (
    <EmptyState
      icon={Key}
      title="Chaves de API"
      description="Gerar chaves para integrar sistemas externos ao MilLead -- ainda não existe no backend."
      comingSoon
    />
  );
}
