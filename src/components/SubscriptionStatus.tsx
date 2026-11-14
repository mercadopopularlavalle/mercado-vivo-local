import { useSuspenseQuery } from "@tanstack/react-query";
import { BadgeCheck, CreditCard, Lock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPaymentNoticeLink, isHttpsUrl } from "@/lib/format";
import { appSettingsQuery, type MyProfile } from "@/lib/my-data";

export function ActiveSubscriptionBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-success">
      <BadgeCheck className="size-4" /> Suscripción Activa
    </span>
  );
}

/** Banner shown to sellers whose store is not enabled this month. */
export function InactiveStoreBanner({ profile, email }: { profile: MyProfile | null; email: string }) {
  const { data: settings } = useSuspenseQuery(appSettingsQuery());
  const payUrl = settings.mercadopago_url && isHttpsUrl(settings.mercadopago_url) ? settings.mercadopago_url : null;
  const storeName = profile?.store_name || profile?.display_name || "Mi tienda";
  const noticeUrl = settings.admin_whatsapp
    ? buildPaymentNoticeLink(settings.admin_whatsapp, storeName, email)
    : null;

  return (
    <section className="overflow-hidden rounded-3xl border border-primary/15 bg-primary-soft">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Lock className="size-6" />
        </span>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-primary">Tu tienda está inactiva</h2>
          <p className="mt-1 text-foreground/80">
            Aboná tu suscripción mensual para habilitar tus publicaciones y aparecer en la vidriera del pueblo.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {payUrl ? (
              <Button asChild size="lg" className="rounded-xl">
                <a href={payUrl} target="_blank" rel="noopener noreferrer">
                  <CreditCard /> Pagar suscripción con Mercado Pago
                </a>
              </Button>
            ) : (
              <Button size="lg" className="rounded-xl" disabled>
                <CreditCard /> Pagar suscripción con Mercado Pago
              </Button>
            )}
            {noticeUrl ? (
              <Button asChild size="lg" variant="outline" className="rounded-xl border-primary/25 bg-card">
                <a href={noticeUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Ya pagué / Avisar por WhatsApp
                </a>
              </Button>
            ) : (
              <Button size="lg" variant="outline" className="rounded-xl border-primary/25 bg-card" disabled>
                <MessageCircle /> Ya pagué / Avisar por WhatsApp
              </Button>
            )}
          </div>
          {(!payUrl || !noticeUrl) && (
            <p className="mt-3 text-xs text-muted-foreground">
              El administrador todavía está configurando los datos de pago. Volvé a mirar en un rato.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
