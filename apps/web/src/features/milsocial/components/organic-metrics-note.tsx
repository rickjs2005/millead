import { Info } from "lucide-react";

/**
 * Aviso de que os números aqui são ORGÂNICOS.
 *
 * A Insights API da Meta devolve apenas o que o post gerou organicamente e não
 * reporta interações vindas de anúncios; o app do Instagram, por outro lado,
 * soma orgânico + pago na mesma tela. Num post impulsionado a diferença é
 * brutal: um reel com 108 de alcance aqui aparecia com 3.381 no app -- mesma
 * data, mesmo post, grandezas diferentes.
 *
 * Sem esta linha, a divergência parece bug de sincronização. É por isso que ela
 * fica visível na tela, e não escondida num tooltip.
 */
export function OrganicMetricsNote() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Métricas <strong className="font-medium text-foreground">orgânicas</strong>. Em posts
        impulsionados os números do app do Instagram são maiores porque incluem o alcance pago — a
        API da Meta não entrega dados de anúncio.
      </span>
    </p>
  );
}
