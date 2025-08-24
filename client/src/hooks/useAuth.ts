import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, refetch, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    // Add a small delay to allow session to be established
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  console.log('useAuth hook - State:', { user, isLoading, error });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    refetch,
    error,
  };
}
