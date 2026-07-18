import type { ReactNode } from "react";
import { ClipboardList, FileSignature, Kanban } from "lucide-react";
import { Logo } from "@/components/logo";

const HIGHLIGHTS = [
  {
    icon: Kanban,
    title: "Pipeline visual",
    description: "Leads em kanban, do primeiro contato ao fechamento.",
  },
  {
    icon: FileSignature,
    title: "Contratos com assinatura",
    description: "PDF gerado e assinado eletronicamente, sem sair do CRM.",
  },
  {
    icon: ClipboardList,
    title: "Briefings por link",
    description: "O cliente preenche o projeto sozinho; você recebe tudo pronto.",
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Painel de marca -- só em telas grandes. */}
      <aside className="relative hidden overflow-hidden bg-zinc-950 text-zinc-50 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_0%,hsl(var(--primary)/0.28),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_30%_20%,black,transparent)]"
        />

        <div className="relative">
          <Logo className="[&_span]:text-zinc-50" />
        </div>

        <div className="relative flex max-w-md flex-col gap-10">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            A operação comercial inteira,
            <br />
            num lugar só.
          </h1>
          <ul className="flex flex-col gap-6">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-sm text-zinc-400">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-zinc-500">
          MilLead · CRM da MilWeb — © {new Date().getFullYear()}
        </p>
      </aside>

      {/* Lado do formulário. */}
      <div className="relative flex items-center justify-center overflow-hidden bg-background px-4 py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--primary)/0.10),transparent)]"
        />
        <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
