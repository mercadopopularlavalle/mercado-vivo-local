import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleButton } from "@/components/GoogleButton";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AFTER_AUTH_KEY, safeRedirect, useAuth } from "@/hooks/use-auth";

type AuthSearch = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ingresar — Mercado Popular" },
      { name: "description", content: "Ingresá o creá tu cuenta en Mercado Popular para publicar tus ventas." },
      { property: "og:title", content: "Ingresar — Mercado Popular" },
      { property: "og:description", content: "Ingresá o creá tu cuenta para publicar tus ventas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const target = safeRedirect(redirect);
  const router = useRouter();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");

  useEffect(() => {
    if (user) router.history.replace(target);
  }, [user, target, router]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("Invalid") ? "Email o contraseña incorrectos" : error.message);
      return;
    }
    toast.success("¡Bienvenido de nuevo!");
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setBusy(true);
    sessionStorage.setItem(AFTER_AUTH_KEY, target);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: String(form.get("name") || "").trim() || undefined },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) setSentTo(email);
  }

  async function handleForgot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSentTo(email);
  }

  async function handleGoogle() {
    setBusy(true);
    sessionStorage.setItem(AFTER_AUTH_KEY, target);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setBusy(false);
      sessionStorage.removeItem(AFTER_AUTH_KEY);
      toast.error("No pudimos ingresar con Google");
      return;
    }
    if (result.redirected) return;
    setBusy(false);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        {sentTo ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <MailCheck className="size-10 text-primary" />
            <h1 className="text-2xl font-bold">Revisá tu email</h1>
            <p className="text-sm text-muted-foreground">
              Te enviamos un enlace a <strong className="text-foreground">{sentTo}</strong>.{" "}
              {mode === "forgot" ? "Abrilo para crear una nueva contraseña." : "Abrilo para confirmar tu cuenta."}
            </p>
            <Button variant="outline" className="mt-2" onClick={() => { setSentTo(null); setMode("login"); }}>
              Volver a ingresar
            </Button>
          </div>
        ) : mode === "forgot" ? (
          <form onSubmit={handleForgot} className="space-y-4">
            <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
            <p className="text-sm text-muted-foreground">Te enviaremos un enlace para crear una nueva.</p>
            <Field id="forgot-email" name="email" label="Email" type="email" autoComplete="email" />
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              Enviar enlace
            </Button>
            <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("login")}>
              Volver
            </button>
          </form>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Tu cuenta en Mercado Popular</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ingresá para publicar y administrar tus ventas.</p>
            <div className="mt-6">
              <GoogleButton onClick={() => void handleGoogle()} disabled={busy} />
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> o con tu email <span className="h-px flex-1 bg-border" />
            </div>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Ingresar</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="mt-4 space-y-4">
                  <Field id="login-email" name="email" label="Email" type="email" autoComplete="email" />
                  <Field id="login-password" name="password" label="Contraseña" type="password" autoComplete="current-password" />
                  <Button type="submit" className="h-11 w-full" disabled={busy}>
                    Ingresar
                  </Button>
                  <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="mt-4 space-y-4">
                  <Field id="signup-name" name="name" label="Nombre" autoComplete="name" required={false} />
                  <Field id="signup-email" name="email" label="Email" type="email" autoComplete="email" />
                  <Field id="signup-password" name="password" label="Contraseña" type="password" autoComplete="new-password" />
                  <Button type="submit" className="h-11 w-full" disabled={busy}>
                    Crear cuenta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
      <Link to="/" search={{}} className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
        Volver a los avisos
      </Link>
    </div>
  );
}

function Field({
  id,
  label,
  required = true,
  ...props
}: { id: string; label: string; required?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required={required} className="h-11" {...props} />
    </div>
  );
}
