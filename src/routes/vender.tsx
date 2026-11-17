import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LogIn, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/vender")({
  head: () => ({
    meta: [
      { title: "Vender en Mercado Popular — Publicá y administrá tu tienda" },
      {
        name: "description",
        content: "Publicá tus productos en Mercado Popular y administrá tu tienda: precios, stock, fotos y datos de tu local.",
      },
      { property: "og:title", content: "Vender en Mercado Popular — Publicá y administrá tu tienda" },
      { property: "og:description", content: "Publicá tus productos y administrá tu tienda en la compraventa local de Lavalle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SellerHome,
});

function SellerHome() {
  const { user, loading } = useAuth();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Quiero vender</h1>
      <p className="mt-2 text-muted-foreground">Elegí qué querés hacer con tu tienda.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <OptionCard
          to="/publicar"
          icon={Plus}
          title="Publicar venta"
          text="Subí un producto o servicio nuevo con fotos y precio."
          iconClass="bg-cta text-cta-foreground"
        />
        <OptionCard
          to="/mis-publicaciones"
          icon={Store}
          title="Mi tienda"
          text="Administrá tus productos, precios, stock y los datos de tu local."
          iconClass="bg-primary text-primary-foreground"
        />
      </div>

      {!loading && !user && (
        <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border border-primary/20 bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            Para vender necesitás una cuenta de comercio. Si todavía no tenés, la creás en un minuto.
          </p>
          <Button asChild className="shrink-0">
            <Link to="/auth" search={{ redirect: undefined }}>
              <LogIn className="size-4" /> Ingresar o registrarme
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function OptionCard({
  to,
  icon: Icon,
  title,
  text,
  iconClass,
}: {
  to: "/publicar" | "/mis-publicaciones";
  icon: typeof Store;
  title: string;
  text: string;
  iconClass: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-soft"
    >
      <span className={`grid size-12 place-items-center rounded-2xl ${iconClass}`}>
        <Icon className="size-6" />
      </span>
      <span>
        <span className="flex items-center gap-2 font-display text-xl font-bold">
          {title}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
      </span>
    </Link>
  );
}
