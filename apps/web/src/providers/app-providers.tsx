"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/services/api-client";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  // Formulários fazem `await mutation.mutateAsync(...)` e deixam a rejeição
  // subir de propósito (é o que impede um dialog de fechar quando a API
  // recusa). O usuário já vê o toast do onError do hook -- mas em dev o
  // Next mostra o overlay de "Unhandled Runtime Error" pra qualquer
  // rejeição não capturada. Marcamos ApiError como tratado aqui, num lugar
  // só, em vez de espalhar try/catch em ~30 handlers. Erros que NÃO são
  // ApiError (bug de código) continuam estourando o overlay, como deve ser.
  useEffect(() => {
    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (event.reason instanceof ApiError) event.preventDefault();
    }
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
