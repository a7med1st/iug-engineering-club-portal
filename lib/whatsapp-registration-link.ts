export function normalizeWhatsAppRegistrationLink(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !["chat.whatsapp.com", "wa.me", "api.whatsapp.com"].includes(url.hostname) ||
      url.pathname === "/" ||
      raw.length > 2048
    ) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error("يرجى إدخال رابط واتساب صحيح يبدأ بـ https://.");
  }
}
