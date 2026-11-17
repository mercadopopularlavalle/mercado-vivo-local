import { Flame, HeartPulse, Mail, Phone, ShieldAlert, Stethoscope } from "lucide-react";
import {
  CLAIMS_EMAIL,
  telHref,
  USEFUL_PHONES,
  type UsefulPhoneId,
} from "@/lib/contacts";

const ICONS: Record<UsefulPhoneId, typeof Phone> = {
  hospital: HeartPulse,
  consultorios: Stethoscope,
  bomberos: Flame,
  policia: ShieldAlert,
};

export function UsefulContacts() {
  return (
    <aside
      aria-label="Teléfonos útiles y contacto para reclamos"
      className="w-full shrink-0 space-y-4 lg:order-first lg:sticky lg:top-[5.5rem] lg:w-60 lg:self-start xl:w-64"
    >
      <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <header className="flex items-center gap-2 bg-primary px-3 py-2.5 text-primary-foreground">
          <Phone className="size-4 shrink-0" />
          <h2 className="font-display text-base font-bold">Teléfonos útiles</h2>
        </header>
        <ul className="divide-y divide-border">
          {USEFUL_PHONES.map((item) => {
            const Icon = ICONS[item.id];
            return (
              <li key={item.id}>
                <a
                  href={telHref(item.phone)}
                  className="flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-primary-soft"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug text-foreground">
                      {item.name}
                    </span>
                    <span className="block text-sm font-bold tabular-nums text-primary">
                      {item.phone}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <header className="flex items-center gap-2 bg-primary px-3 py-2.5 text-primary-foreground">
          <Mail className="size-4 shrink-0" />
          <h2 className="font-display text-base font-bold">Reclamos y sugerencias</h2>
        </header>
        <div className="p-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Escribinos para hacer un reclamo, sugerir una mejora o avisarnos algo sobre tu
            publicación.
          </p>
          <a
            href={`mailto:${CLAIMS_EMAIL}`}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-cta px-2 py-2 text-[11px] font-semibold text-cta-foreground transition-opacity hover:opacity-90"
          >
            <Mail className="size-3.5 shrink-0" />
            <span className="break-all leading-tight">{CLAIMS_EMAIL}</span>
          </a>
        </div>
      </section>
    </aside>
  );
}
