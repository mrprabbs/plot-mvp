import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export type SessionUser = {
  id: number;
  fullName: string;
  email: string;
  role: "owner" | "driver";
  createdAt: string;
  updatedAt: string;
};

type SessionResponse = {
  user: SessionUser;
};

export function useSessionUser() {
  const query = useQuery<SessionResponse | null>({
    queryKey: ["/api/auth/session"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  return {
    ...query,
    user: query.data?.user ?? null,
    isAuthenticated: Boolean(query.data?.user),
  };
}
