"use client";

import {
  type DefaultError,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";
import { useHasMounted } from "@/hooks/use-has-mounted";

export type PersistedQueryResult<TData, TError> = UseQueryResult<
  TData,
  TError
> & {
  hydrationLoading: boolean;
  hydratedData: TData | undefined;
};

export function usePersistedQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): PersistedQueryResult<TData, TError> {
  const hasMounted = useHasMounted();
  const query = useQuery(options);

  return {
    ...query,
    hydrationLoading: !hasMounted || query.isLoading,
    hydratedData: hasMounted ? query.data : undefined,
  };
}
