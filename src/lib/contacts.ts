/**
 * Datos de contacto del pueblo que se muestran en la columna lateral.
 * Editar acá: teléfonos útiles de emergencia/salud y el correo de reclamos.
 */

export type UsefulPhoneId = "hospital" | "consultorios" | "bomberos" | "policia";

export type UsefulPhone = {
  id: UsefulPhoneId;
  name: string;
  phone: string;
};

export const USEFUL_PHONES: UsefulPhone[] = [
  { id: "hospital", name: "Hospital Sagrado Corazón de Jesús", phone: "225249-1037" },
  { id: "consultorios", name: "Consultorios externos", phone: "2257417936" },
  { id: "bomberos", name: "Bomberos Cuartel 233 Central", phone: "2257582740" },
  { id: "policia", name: "Policía", phone: "2252491099" },
];

export const CLAIMS_EMAIL = "mercadopopularlavalle@gmail.com";

/** href listo para un enlace de llamada: solo los dígitos del teléfono. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/\D/g, "")}`;
}

/** href listo para un enlace de correo. */
export function mailtoHref(email: string = CLAIMS_EMAIL): string {
  return `mailto:${email.trim().toLowerCase()}`;
}
