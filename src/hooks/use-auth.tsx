import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = { user: User | null; loading: boolean };

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export const AFTER_AUTH_KEY = "mp:after-auth";

/** Accepts only same-origin relative paths. */
export function safeRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ user: session?.user ?? null, loading: false });
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
      if (event === "SIGNED_IN") {
        const pending = sessionStorage.getItem(AFTER_AUTH_KEY);
        if (pending) {
          sessionStorage.removeItem(AFTER_AUTH_KEY);
          router.history.push(safeRedirect(pending));
        }
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      setState({ user: data.session?.user ?? null, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
