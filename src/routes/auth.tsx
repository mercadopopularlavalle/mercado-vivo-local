import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { MailCheck, ShoppingBag, Store, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleButton } from "@/components/GoogleButton";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AFTER_AUTH_KEY, safeRedirect, useAuth } from "@/hooks/use-auth";
import { saveMyProfile } from "@/lib/my-data";
import { formatPrice, isValidWhatsapp, normalizeWhatsapp } from "@/lib/format";
import type { SavedFavoriteItem } from "@/components/ListingCard";

type AuthSearch = {
  redirect?: string | undefined;
  role?: "buyer" | "seller" | undefined;
};

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
    role: search["role"] === "buyer" || search["role"] === "seller" ? search["role"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ingreso y Registro — Mercado Popular" },
      { name: "description", content: "Ingresá como comprador para guardar tus 'Esto me gusta' o como comerciante para administrar tu tienda." },
      { property: "og:title", content: "Ingreso y Registro — Mercado Popular" },
      { property: "og:description", content: "Ingresá o creá tu cuenta en Mercado Popular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect, role: initialRole } = Route.useSearch();
  const router = useRouter();
  const { user } = useAuth();
  const [role, setRole] = useState<"buyer" | "seller">(initialRole ?? "buyer");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialRole === "buyer" ? "signup" : "login");

  const defaultTarget = role === "buyer" ? "/comprar" : "/mis-publicaciones";
  const target = redirect ? safeRedirect(redirect) : defaultTarget;

  const userRole = (user?.user_metadata?.role as string | undefined) ?? "seller";
  const favorites = Array.isArray(user?.user_metadata?.favorites)
    ? (user.user_metadata.favorites as SavedFavoriteItem[])
    : [];

  useEffect(() => {
    if (user && userRole !== "buyer" && initialRole !== "buyer") {
      router.history.replace(target);
    }
  }, [user, userRole, initialRole, target, router]);

  async function handleRemoveFavorite(id: string) {
    if (!user) return;
    const updated = favorites.filter((item) => item.id !== id);
    const { error } = await supabase.auth.updateUser({
      data: { ...user.user_metadata, favorites: updated },
    });
    if (error) {
      toast.error("No se pudo quitar de tu lista");
      return;
    }
    toast.success("Quitado de tus 'Esto me gusta'");
  }

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
    toast.success(role === "buyer" ? "¡Bienvenido! Ya podés guardar tus 'Esto me gusta'" : "¡Bienvenido a tu panel de tienda!");
    router.history.replace(target);
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

    if (role === "seller" && whatsapp && !isValidWhatsapp(whatsapp)) {
      toast.error("Ingresá un WhatsApp válido con código de país (ej. 5492615550101)");
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
          store_name: role === "seller" ? storeName || undefined : undefined,
          whatsapp: role === "seller" && whatsapp ? normalizeWhatsapp(whatsapp) : undefined,
          role,
          favorites: [],
        },
      },
    });

    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    if (role === "seller" && data.user?.id) {
      try {
        await saveMyProfile(data.user.id, {
          display_name: name || "Comerciante",
          store_name: storeName || null,
          whatsapp: whatsapp ? normalizeWhatsapp(whatsapp) : null,
        });
      } catch {
        // Silently continue
      }
    }

    setBusy(false);
    if (!data.session) {
      setSentTo(email);
    } else {
      toast.success(
        role === "buyer"
          ? "¡Cuenta de comprador creada! Ya podés marcar 🤩 'Esto me gusta'"
          : "¡Cuenta de comercio creada con éxito!",
      );
      router.history.replace(target);
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

  // Si el comprador ya inició sesión, mostrar su panel con sus "Esto me gusta"
  if (user) {
    const buyerName =
      (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "Comprador";

    return (
      <div className="mx-auto flex max-w-2xl flex-col px-4 py-10 sm:py-14">
        <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-amber-100 text-2xl">
                🤩
              </span>
              <div>
                <h1 className="text-xl font-extrabold sm:text-2xl">Hola, {buyerName}</h1>
                <p className="text-xs text-muted-foreground">Tus productos guardados en "Esto me gusta"</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="cta" className="rounded-xl">
                <Link to="/comprar">Seguir viendo productos</Link>
              </Button>
              {userRole !== "buyer" && (
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <Link to="/mis-publicaciones">Ir a Mi Tienda</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6">
            {favorites.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="text-3xl">🤩</p>
                <h2 className="mt-2 text-base font-bold">Todavía no marcaste ningún "Esto me gusta"</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tocá el botón <strong>🤩 Esto me gusta</strong> en cualquier producto para guardarlo acá y revisarlo cuando quieras.
                </p>
                <Button asChild className="mt-4 rounded-xl">
                  <Link to="/comprar">Explorar negocios de Lavalle</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {favorites.length} {favorites.length === 1 ? "producto guardado" : "productos guardados"}
                </p>
                {favorites.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-background p-3"
                  >
                    <Link
                      to="/aviso/$id"
                      params={{ id: item.id }}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="size-full object-cover" />
                        ) : (
                          <div className="grid size-full place-items-center text-lg">🤩</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{item.title}</p>
                        <p className="font-display text-base font-extrabold text-primary">
                          {formatPrice(item.price)}
                        </p>
                        {item.location && (
                          <p className="truncate text-xs text-muted-foreground">{item.location}</p>
                        )}
                      </div>
                    </Link>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleRemoveFavorite(item.id)}
                      title="Quitar de Esto me gusta"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
              {mode === "forgot" ? "Abrilo para crear una nueva contraseña." : "Abrilo para confirmar tu cuenta."}
            </p>
            <Button variant="outline" className="mt-2" onClick={() => { setSentTo(null); setMode("login"); }}>
              Volver
            </Button>
          </div>
        ) : mode === "forgot" ? (
          <form onSubmit={handleForgot} className="space-y-4">
            <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
            <p className="text-sm text-muted-foreground">Te enviaremos un enlace para crear una nueva.</p>
            <Field id="forgot-email" name="email" label="Tu email" type="email" autoComplete="email" />
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              Enviar enlace
            </Button>
            <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("login")}>
              Volver
            </button>
          </form>
        ) : (
          <>
            {/* Selector de rol sin botones redundantes */}
            <div className="mb-6 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRole("buyer")}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 text-center transition-all ${
                  role === "buyer"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingBag className="size-5" />
                <span className="text-sm font-bold">Soy Comprador</span>
                <span className="text-[11px] opacity-80">Guardar 🤩 Esto me gusta</span>
              </button>

              <button
                type="button"
                onClick={() => setRole("seller")}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 text-center transition-all ${
                  role === "seller"
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <Store className="size-5" />
                <span className="text-sm font-bold">Soy Comerciante</span>
                <span className="text-[11px] opacity-80">Administrar Mi Tienda</span>
              </button>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Ya tengo cuenta</TabsTrigger>
                <TabsTrigger value="signup">Registrarme gratis</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="mt-4 space-y-4">
                  <Field id="login-email" name="email" label="Email" type="email" autoComplete="email" placeholder="tuemail@ejemplo.com" />
                  <Field id="login-password" name="password" label="Contraseña" type="password" autoComplete="current-password" />
                  <Button type="submit" className="h-11 w-full" disabled={busy}>
                    {role === "buyer" ? "Entrar a mi cuenta" : "Entrar a Administrar mi Tienda"}
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
                  {role === "seller" ? (
                    <>
                      <Field id="signup-store" name="storeName" label="Nombre de tu Local / Tienda" placeholder="Ej: Verdulería Don Pepe, Boutique Central" required />
                      <Field id="signup-name" name="name" label="Nombre del titular / responsable" placeholder="Tu nombre y apellido" required />
                      <Field id="signup-whatsapp" name="whatsapp" label="WhatsApp del comercio" placeholder="5492615550101" required />
                    </>
                  ) : (
                    <Field id="signup-name" name="name" label="Tu nombre" placeholder="Ej: María Gómez" required />
                  )}
                  <Field id="signup-email" name="email" label="Email" type="email" autoComplete="email" placeholder="tuemail@ejemplo.com" required />
                  <Field id="signup-password" name="password" label="Contraseña (mínimo 6 caracteres)" type="password" autoComplete="new-password" required />
                  <Button type="submit" variant="cta" className="mt-2 h-11 w-full" disabled={busy}>
                    <UserCheck className="mr-1.5 size-4" />
                    {role === "buyer" ? "Crear cuenta y guardar 🤩 Me gusta" : "Crear Cuenta de Comercio"}
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
