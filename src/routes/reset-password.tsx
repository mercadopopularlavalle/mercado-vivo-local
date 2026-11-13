import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña — Mercado Popular" },
      { name: "description", content: "Creá una nueva contraseña para tu cuenta de Mercado Popular." },
      { property: "og:title", content: "Nueva contraseña — Mercado Popular" },
      { property: "og:description", content: "Creá una nueva contraseña para tu cuenta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contraseña actualizada");
    navigate({ to: "/mis-publicaciones" });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Nueva contraseña</h1>
        {ready ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña nueva</Label>
              <Input id="password" name="password" type="password" required autoComplete="new-password" className="h-11" />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              Guardar contraseña
            </Button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Abrí esta página desde el enlace que te enviamos por email para crear tu nueva contraseña.
          </p>
        )}
      </div>
    </div>
  );
}
