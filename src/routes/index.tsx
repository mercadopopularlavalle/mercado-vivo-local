import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag, Store } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mercado Popular — Los negocios de Lavalle en un solo lugar" },
      {
        name: "description",
        content:
          "Bienvenido a Mercado Popular, la compraventa local de Lavalle. Elegí si querés comprar sin registrarte o vender con tu propia tienda.",
      },
      { property: "og:title", content: "Mercado Popular — Los negocios de Lavalle en un solo lugar" },
      {
        property: "og:description",
        content: "Comprá sin registrarte o vendé con tu tienda en la compraventa local de Lavalle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <div className="bg-hero flex min-h-screen flex-col items-center justify-center px-5 py-12 text-primary-foreground">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <img
          src="/logo.jpeg"
          alt="Mercado Popular"
          className="size-32 rounded-3xl bg-card object-contain p-2 shadow-xl sm:size-40"
        />
        <h1 className="mt-6 font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
          Mercado <span className="text-highlight">Popular</span>
        </h1>
        <p className="mt-3 text-lg text-primary-foreground/85 sm:text-xl">
          Los negocios de Lavalle en un solo lugar.
        </p>

        <div className="mt-10 flex w-full flex-col gap-4">
          <ChoiceButton
            to="/comprar"
            icon={ShoppingBag}
            label="Quiero comprar"
            hint="Mirá productos y servicios sin registrarte"
            className="bg-card text-foreground"
            iconClass="bg-primary-soft text-primary"
          />
          <ChoiceButton
            to="/vender"
            icon={Store}
            label="Quiero vender"
            hint="Publicá tus productos y administrá tu tienda"
            className="bg-cta text-cta-foreground"
            iconClass="bg-primary-foreground/20 text-cta-foreground"
          />
        </div>
      </div>
    </div>
  );
}

function ChoiceButton({
  to,
  icon: Icon,
  label,
  hint,
  className,
  iconClass,
}: {
  to: "/comprar" | "/vender";
  icon: typeof Store;
  label: string;
  hint: string;
  className: string;
  iconClass: string;
}) {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-4 rounded-2xl px-5 py-4 text-left shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.99] ${className}`}
    >
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${iconClass}`}>
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-bold leading-tight">{label}</span>
        <span className="block text-sm opacity-80">{hint}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
