import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck, Store, UserRound } from "lucide-react";
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
import { isAdminQuery } from "@/lib/my-data";
import { Logo } from "./Logo";

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: isAdmin } = useQuery({ ...isAdminQuery(user?.id ?? ""), enabled: !!user });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", search: {}, replace: true });
  }

  const name =
    (user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email?.split("@")[0] ?? "";

  return (
    <header className="sticky top-0 z-40 w-full overflow-x-hidden bg-primary text-primary-foreground shadow-md">
      <div className="mx-auto flex min-h-[4rem] sm:min-h-[5rem] max-w-6xl items-center justify-between gap-2 px-3 sm:px-4 py-2">
        <div className="min-w-0 shrink">
          <Logo />
        </div>

        {user && (
          <nav className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mi cuenta"
                  className="size-9 shrink-0 rounded-full bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 hover:text-primary-foreground"
                >
                  <UserRound className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/mis-publicaciones">
                    <Store className="size-4
