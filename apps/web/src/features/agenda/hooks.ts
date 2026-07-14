import { useQuery } from "@tanstack/react-query";
import { meetingsService } from "@/services/meetings";
import { tasksService } from "@/services/tasks";

export function useMonthMeetings(from: string, to: string) {
  return useQuery({
    queryKey: ["agenda", "meetings", from, to],
    queryFn: () => meetingsService.list({ from, to, pageSize: 100 }),
  });
}

/**
 * Não existe filtro de intervalo de data pra tarefas na API (só
 * `overdue`) -- busca as 100 tarefas pendentes mais próximas do
 * vencimento (a API já ordena por `dueAt` asc) e filtra pro mês em tela
 * no client. Cobre bem o uso normal; um board com mais de 100 tarefas
 * pendentes simultâneas no radar precisaria de um filtro de data de
 * verdade no backend.
 */
export function usePendingTasksForCalendar() {
  return useQuery({
    queryKey: ["agenda", "tasks", "pending"],
    queryFn: () => tasksService.list({ status: "PENDING", pageSize: 100 }),
  });
}
