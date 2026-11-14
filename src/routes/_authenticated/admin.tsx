import { useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Store, Users, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, isHttpsUrl, isValidWhatsapp, normalizeWhatsapp } from "@/lib/format";
import { appSettingsQuery } from "@/lib/my-data";
import { cn } from "@/lib/utils";

type Seller = {
  id: string;
  display_name: string;
  store_name: string | null;
  whatsapp: string | null;
  city: string | null;
  is_active: boolean;
  created_at: string;
  email: string | null;
  listings_count: number;
  is_admin: boolean;
};

const sellersQuery = () =>
  queryOptions({
    queryKey: ["admin-sellers"],
    queryFn: async (): Promise<Seller[]> => {
      const { data, error } = await supabase.rpc("admin_list_sellers");
      if (error) throw error;
      return (data ?? []).map((s) => ({ ...s, listings_count: Number(s.listings_count) }));
    },
  });

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/", search: {} });
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(sellersQuery()),
      context.queryClient.ensureQueryData(appSettingsQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Panel de administración — Mercado Popular" },
      { name: "description", content: "Habilitá o pausá las tiendas de los vendedores según su suscripción mensual." },
      { property: "og:title", content: "Panel de administración — Mercado Popular" },
      { property: "og:description", content: "Gestión de suscripciones de vendedores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: sellers } = useSuspenseQuery(sellersQuery());
  const active = sellers.filter((s) => s.is_active).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Panel de administración</h1>
      <p className="mt-1 text-muted-foreground">Activá cada tienda cuando recibas el pago de su suscripción mensual.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat icon={<Users className="size-5" />} label="Vendedores" value={sellers.length} />
        <Stat icon={<UserCheck className="size-5" />} label="Activos" value={active} tone="success" />
        <Stat icon={<UserX className="size-5" />} label="Inactivos" value={sellers.length - active} />
      </div>

      <div className="mt-8 space-y-8">
        <SettingsCard />
        <section className="overflow-hidden rounded-3xl border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary-soft hover:bg-primary-soft">
                  <TableHead className="text-primary">Tienda</TableHead>
                  <TableHead className="text-primary">Dueño</TableHead>
                  <TableHead className="text-primary">WhatsApp</TableHead>
                  <TableHead className="text-primary">Registro</TableHead>
                  <TableHead className="text-right text-primary">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellers.map((s) => (
                  <SellerRow key={s.id} seller={s} />
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone?: "success" }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          tone === "success" ? "bg-success-soft text-success" : "bg-primary-soft text-primary",
        )}
      >
        {icon}
      </span>
      <div>
        <p className="font-display text-2xl font-extrabold leading-none">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SellerRow({ seller }: { seller: Seller }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.from("profiles").update({ is_active: next }).eq("id", seller.id);
      if (error) throw error;
      return next;
    },
    onSuccess: async (next) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      await queryClient.invalidateQueries({ queryKey: ["my-profile", seller.id] });
      toast.success(next ? "Tienda activada" : "Tienda desactivada");
    },
    onError: () => toast.error("No pudimos cambiar el estado"),
  });
  const checked = toggle.isPending ? !!toggle.variables : seller.is_active;

  return (
    <TableRow>
      <TableCell className="min-w-44">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
            <Store className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{seller.store_name || seller.display_name}</p>
            <p className="text-xs text-muted-foreground">
              {seller.listings_count} {seller.listings_count === 1 ? "aviso" : "avisos"}
              {seller.city ? ` · ${seller.city}` : ""}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="min-w-48">
        <p className="font-medium">
          {seller.display_name}
          {seller.is_admin && (
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">
              Admin
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{seller.email ?? "Cuenta de ejemplo"}</p>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {seller.whatsapp ? (
          <a
            href={`https://wa.me/${seller.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            +{seller.whatsapp}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(seller.created_at)}</TableCell>
      <TableCell className="text-right">
        <label className="inline-flex cursor-pointer items-center gap-2.5">
          <span
            className={cn(
              "w-16 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold",
              checked ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {checked ? "Activo" : "Inactivo"}
          </span>
          <Switch
            checked={checked}
            disabled={toggle.isPending}
            onCheckedChange={(v) => toggle.mutate(v)}
            aria-label={`Estado de ${seller.store_name || seller.display_name}`}
            className="data-[state=checked]:bg-success"
          />
        </label>
      </TableCell>
    </TableRow>
  );
}

function SettingsCard() {
  const { data: settings } = useSuspenseQuery(appSettingsQuery());
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const url = String(form.get("mp") ?? "").trim();
    const phone = String(form.get("wa") ?? "").trim();
    if (url && !isHttpsUrl(url)) {
      toast.error("El enlace de Mercado Pago debe empezar con https://");
      return;
    }
    if (phone && !isValidWhatsapp(phone)) {
      toast.error("WhatsApp inválido: usá código de país, ej. 5491155550101");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ mercadopago_url: url || null, admin_whatsapp: phone ? normalizeWhatsapp(phone) : null })
      .eq("id", true);
    setBusy(false);
    if (error) {
      toast.error("No pudimos guardar la configuración");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    toast.success("Configuración guardada");
  }

  return (
    <aside className="rounded-3xl border bg-card p-6">
      <h2 className="text-lg font-bold">Cobro de la suscripción</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Esto ven los vendedores con la tienda inactiva.
      </p>
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="mp">Link de suscripción de Mercado Pago</Label>
          <Input
            id="mp"
            name="mp"
            type="url"
            defaultValue={settings.mercadopago_url ?? ""}
            placeholder="https://www.mercadopago.com.ar/subscriptions/…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa">Tu WhatsApp para avisos de pago</Label>
          <Input id="wa" name="wa" inputMode="tel" defaultValue={settings.admin_whatsapp ?? ""} placeholder="5491155550101" />
        </div>
        <Button type="submit" className="w-full md:w-auto" disabled={busy}>
          Guardar configuración
        </Button>
      </form>
    </aside>
  );
}
