"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { useAuthStore } from "@/stores/auth-store";

/** Só decide pra onde mandar (login vs dashboard) -- não é uma tela em si. */
export default function RootPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const redirect = () => {
      const authenticated = useAuthStore.getState().accessToken !== null;
      router.replace(authenticated ? "/dashboard" : "/login");
      setChecked(true);
    };
    if (useAuthStore.persist.hasHydrated()) {
      redirect();
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(redirect);
      return unsub;
    }
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className={checked ? "opacity-0" : "animate-pulse opacity-100"}>
        <Logo />
      </div>
    </div>
  );
}
