import { Users2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function TeamSettingsPage() {
  return (
    <EmptyState
      icon={Users2}
      title="Gestão de equipe"
      description="Convidar membros, atribuir papéis e gerenciar permissões -- a API de gestão de membros ainda não existe."
      comingSoon
    />
  );
}
