import { useState, type FormEvent } from "react";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldMinus, ShieldPlus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

type AdminAccount = { user_id: string; email: string | null; display_name: string | null; granted_at: string };

export const adminsQuery = () =>
  queryOptions({
    queryKey: ["admin-admins"],
    queryFn: async (): Promise<AdminAccount[]> => {
      const { data, error } = await supabase.rpc("admin_list_admins");
      if (error) throw error;
      return data ?? [];
    },
  });

/** Maps the database's refusal codes to messages for the admin. */
function roleErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? "");
  if (msg.includes("user_not_found")) return "No hay ninguna cuenta registrada con ese email. Pedile que se registre primero.";
  if (msg.includes("cannot_revoke_self")) return "No podés quitarte tu propio permiso de administrador.";
  if (msg.includes("last_admin")) return "Tiene que quedar al menos un administrador.";
  if (msg.includes("forbidden")) return "Tu cuenta ya no tiene permiso para hacer esto.";
  return "No pudimos completar la acción. Probá de nuevo.";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminAccessCard({ currentUserId }: { currentUserId: string }) {
  const { data: admins } = useSuspenseQuery(adminsQuery());
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
  };

  const grant = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.rpc("admin_grant_admin", { _email: value });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      setEmail("");
      toast.success("Permiso de administrador concedido");
    },
    onError: (e) => toast.error(roleErrorMessage(e)),
  });

  const revoke = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("admin_revoke_admin", { _user_id: userId });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Permiso de administrador quitado");
    },
    onError: (e) => toast.error(roleErrorMessage(e)),
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      toast.error("Escribí un email válido");
      return;
    }
    if (admins.some((a) => a.email?.toLowerCase() === value.toLowerCase())) {
      toast.info("Esa cuenta ya es administradora");
      return;
    }
    setConfirmOpen(true);
  }

  const onlyOne = admins.length <= 1;

  return (
    <section className="rounded-3xl border bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold">Administradores</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Estas cuentas pueden activar tiendas, cambiar el cobro y gestionar permisos. Solo concedé acceso a personas de confianza.
          </p>
        </div>
      </div>

      <ul className="mt-5 divide-y rounded-2xl border">
        {admins.map((a) => {
          const isMe = a.user_id === currentUserId;
          const name = a.display_name || a.email || "Cuenta";
          return (
            <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {name}
                  {isMe && (
                    <span className="ml-2 rounded-full bg-highlight px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      Vos
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.email ?? "—"} · desde {formatDate(a.granted_at)}
                </p>
              </div>
              {isMe || onlyOne ? (
                <span className="text-xs text-muted-foreground">
                  {isMe ? "No podés quitarte tu propio acceso" : "Único administrador"}
                </span>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={revoke.isPending}>
                      <ShieldMinus className="size-4" /> Quitar permiso
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Quitar el permiso de administrador?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {name} ({a.email}) ya no va a poder entrar al panel de administración. Su tienda y sus avisos no cambian.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => revoke.mutate(a.user_id)}
                      >
                        Quitar permiso
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          );
        })}
      </ul>

      <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="admin-email">Dar permiso a otra cuenta</Label>
          <Input
            id="admin-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email con el que se registró"
          />
        </div>
        <Button type="submit" disabled={grant.isPending}>
          <ShieldPlus className="size-4" /> Hacer administrador
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">La persona tiene que haberse registrado antes en Mercado Popular.</p>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Hacer administrador a {email.trim()}?</AlertDialogTitle>
            <AlertDialogDescription>
              Va a poder activar y desactivar tiendas, cambiar el link de cobro y dar o quitar permisos a otros administradores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => grant.mutate(email.trim())}>Sí, dar permiso</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
