import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { MailCheck, Store, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleButton } from "@/components/GoogleButton";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AFTER_AUTH_KEY, safeRedirect, useAuth } from "@/hooks/use-auth";
import { saveMyProfile } from "@/lib/my-data";
import { isValidWhatsapp, normalizeWhatsapp } from "@/lib/format";

type AuthSearch = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Acceso Comerciantes — Mercado Popular" },
      { name: "description", content: "Ingresá o creá tu cuenta comercial para administrar tu tienda e inventario en Mercado Popular." },
      { property: "og:title", content: "Acceso Comerciantes — Mercado Popular" },
      { property: "og:description", content: "Ingresá o creá tu cuenta comercial en Mercado Popular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  // Al entrar, redirigir por defecto al panel "Administrar mi Tienda"
  const defaultTarget = "/mis-publicaciones";
  const target = redirect ? safeRedirect(redirect) : defaultTarget;
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
    toast.success("¡Bienvenido a tu panel de tienda!");
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const name = String(form.get("name") || "").trim();
    const storeName = String(form.get("storeName") || "").trim();
    const whatsapp = String(form.get("whatsapp") || "").trim();

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (whatsapp && !isValidWhatsapp(whatsapp)) {
      toast.error("Ingresá un WhatsApp válido con código de país (ej. 5491155550101)");
      return;
    }

    setBusy(true);
    sessionStorage.setItem(AFTER_AUTH_KEY, target);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: name || undefined,
          store_name: storeName || undefined,
          whatsapp: whatsapp ? normalizeWhatsapp(whatsapp) : undefined,
          role: "seller",
        },
      },
    });

    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    if (data.user?.id) {
      try {
        await saveMyProfile(data.user.id, {
          display_name: name || "Comerciante",
          store_name: storeName || null,
          whatsapp: whatsapp ? normalizeWhatsapp(whatsapp) : null,
        });
      } catch {
        // Silently continue if triggered on backend
      }
    }

    setBusy(false);
    if (!data.session) {
      setSentTo(email);
    } else {
      toast.success("¡Cuenta de comercio creada con éxito!");
    }
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
    <div className="mx-auto flex max-w-lg flex-col px-4 py-10 sm:py-16">
      <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        {sentTo ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <MailCheck className="size-10 text-primary" />
            <h1 className="text-2xl font-bold">Revisá tu email</h1>
            <p className="text-sm text-muted-foreground">
              Te enviamos un enlace a <strong className="text-foreground">{sentTo}</strong>.{" "}
              {mode === "forgot" ? "Abrilo para crear una nueva contraseña." : "Abrilo para confirmar tu cuenta y habilitar tu tienda."}
            </p>
            <Button variant="outline" className="mt-2" onClick={() => { setSentTo(null); setMode("login"); }}>
              Volver a ingresar
            </Button>
          </div>
        ) : mode === "forgot" ? (
          <form onSubmit={handleForgot} className="space-y-4">
            <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
            <p className="text-sm text-muted-foreground">Te enviaremos un enlace para crear una nueva.</p>
            <Field id="forgot-email" name="email" label="Email de tu comercio" type="email" autoComplete="email" />
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              Enviar enlace
            </Button>
            <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("login")}>
              Volver
            </button>
          </form>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground shadow-sm">
                <Store className="size-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight">Acceso Comerciantes</h1>
                <p className="text-xs text-muted-foreground">Administrá tu inventario, ventas y datos de tu local</p>
              </div>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Ingresar a mi Tienda</TabsTrigger>
                <TabsTrigger value="signup">Registrar Comercio</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="mt-4 space-y-4">
                  <Field id="login-email" name="email" label="Email" type="email" autoComplete="email" placeholder="comercio@ejemplo.com" />
                  <Field id="login-password" name="password" label="Contraseña" type="password" autoComplete="current-password" />
                  <Button type="submit" className="h-11 w-full" disabled={busy}>
                    <Store className="size-4 mr-1.5" /> Entrar a Administrar mi Tienda
                  </Button>
                  <div className="mt-4">
                    <GoogleButton onClick={() => void handleGoogle()} disabled={busy} />
                  </div>
                  <div className="pt-2 text-center">
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="mt-4 space-y-3.5">
                  <Field id="signup-store" name="storeName" label="Nombre de tu Local / Tienda" placeholder="Ej: Verdulería Don Pepe, Boutique Central" required />
                  <Field id="signup-name" name="name" label="Nombre del titular / responsable" placeholder="Tu nombre y apellido" required />
                  <Field id="signup-whatsapp" name="whatsapp" label="WhatsApp del comercio (para recibir pedidos)" placeholder="5491155550101" required />
                  <Field id="signup-email" name="email" label="Email de registro" type="email" autoComplete="email" placeholder="comercio@ejemplo.com" required />
                  <Field id="signup-password" name="password" label="Contraseña (mínimo 6 caracteres)" type="password" autoComplete="new-password" required />
                  <Button type="submit" variant="cta" className="h-11 w-full mt-2" disabled={busy}>
                    <UserCheck className="size-4 mr-1.5" /> Crear Cuenta y Empezar a Administrar
                  </Button>
                  <div className="mt-4">
                    <GoogleButton onClick={() => void handleGoogle()} disabled={busy} />
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
      <Link to="/" search={{}} className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
        Volver a la portada de Mercado Popular
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
      <Label htmlFor={id} className="text-xs font-semibold">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input id={id} required={required} className="h-11" {...props} />
    </div>
  );
}
