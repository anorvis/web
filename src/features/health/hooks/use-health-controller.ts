import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMealById, postHealthForm } from "@/features/health/api/health";
import { useHealthStore } from "@/features/health/stores/health-store";
import { queryKeys } from "@/lib/query/keys";

export function useHealthController() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (path: string, onSuccess?: () => void) => {
    return (formData: FormData) => {
      setError(null);
      startTransition(async () => {
        try {
          await postHealthForm(path, formData);
          onSuccess?.();
          await queryClient.invalidateQueries({
            queryKey: queryKeys.health.dashboard(),
          });
          router.refresh();
        } catch (submitError) {
          setError(
            submitError instanceof Error ? submitError.message : "save failed",
          );
        }
      });
    };
  };

  return {
    error,
    isPending,
    deleteMeal: (id: string, onSuccess?: () => void) => {
      setError(null);
      startTransition(async () => {
        try {
          await deleteMealById(id);
          onSuccess?.();
          await queryClient.invalidateQueries({
            queryKey: queryKeys.health.dashboard(),
          });
          router.refresh();
        } catch (deleteError) {
          setError(
            deleteError instanceof Error
              ? deleteError.message
              : "delete failed",
          );
        }
      });
    },
    submit,
    closeMeal: () => useHealthStore.getState().setMealOpen(false),
    closeWorkout: () => useHealthStore.getState().setWorkoutOpen(false),
    closeQuiz: () => useHealthStore.getState().setQuizOpen(false),
  };
}
