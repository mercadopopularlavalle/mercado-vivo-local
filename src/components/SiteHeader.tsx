import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutList, LogOut, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "./Logo";

export function SiteHeader() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", search: {}, replace: true });
  }

  const name =
    (user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email?.split("@")[0] ?? "";

  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Logo />
        <nav className="ml-auto flex items-center gap-2">
          <Link
            to="/mis-publicaciones"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-primary-foreground/85 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground sm:inline-flex"
            activeProps={{ className: "bg-primary-foreground/10 text-primary-foreground" }}
          >
            Mis publicaciones
          </Link>
          <Button asChild variant="accent">
            <Link to="/publicar">
              <Plus />
              <span>Publicar venta</span>
            </Link>
          </Button>
          {!loading && !user && (
            <Button
              asChild
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/auth">Ingresar</Link>
            </Button>
          )}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mi cuenta"
                  className="rounded-full bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                >
                  <UserRound />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/mis-publicaciones">
                    <LayoutList className="size-4" /> Mis publicaciones
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut className="size-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>
    </header>
  );
}
