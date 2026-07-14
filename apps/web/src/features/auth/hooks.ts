import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/services/api-client";
import {
  authService,
  isOrganizationChoice,
  type LoginPayload,
  type RegisterPayload,
} from "@/services/auth";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/auth-store";

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: authService.me,
    enabled,
    retry: false,
  });
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: (result) => {
      if (isOrganizationChoice(result)) return; // tratado pela tela (escolher org e logar de novo)
      setSession(result);
      toast.success(`Bem-vindo de volta, ${result.user.name.split(" ")[0]}.`);
      router.push("/dashboard");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    },
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: (result) => {
      setSession(result);
      toast.success("Conta criada! Vamos começar.");
      router.push("/dashboard");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a conta.");
    },
  });
}

export function useLogout() {
  const { refreshToken, clear } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      if (refreshToken) await authService.logout(refreshToken).catch(() => undefined);
    },
    onSuccess: () => {
      clear();
      queryClient.clear();
      router.push("/login");
    },
  });
}
