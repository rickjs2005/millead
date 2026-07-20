"use client";

import { CheckCircle2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Card, CardContent } from "@/components/ui/card";
import { ContractForm } from "@/features/contracts/components/contract-form";
import { createPublicContract } from "@/services/contracts";

/**
 * Página PÚBLICA de fechamento -- o cliente preenche os próprios dados e o
 * contrato entra direto no pipeline (PDF + assinatura). Sem login; o slug
 * na URL identifica a organização (ex.: /fechamento/milweb).
 */
export default function PublicClosingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [pending, setPending] = useState(false);
  const [numero, setNumero] = useState<string | null>(null);

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo />
          <h1 className="text-2xl font-semibold tracking-tight">Fechamento de contrato</h1>
          <p className="max-w-lg text-sm text-muted-foreground">
            Preencha seus dados e as condições combinadas. Você recebe o contrato em PDF e o link de
            assinatura eletrônica por e-mail.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {numero ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <CheckCircle2 className="h-12 w-12 text-success" />
                <h2 className="text-lg font-semibold">Contrato {numero} criado!</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Estamos gerando o PDF e o link de assinatura. Fique de olho no seu e-mail — o
                  convite pra assinar chega em instantes.
                </p>
              </div>
            ) : (
              <ContractForm
                pending={pending}
                submitLabel="Enviar e gerar contrato"
                onSubmit={async (values) => {
                  setPending(true);
                  try {
                    const result = await createPublicContract(slug, values);
                    setNumero(result.numero);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erro ao enviar.");
                  } finally {
                    setPending(false);
                  }
                }}
              />
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Seus dados são usados exclusivamente pra emissão do contrato.
        </p>
      </div>
    </div>
  );
}
