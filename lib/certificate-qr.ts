export type CertificateQrSettings = { visible: boolean; x: number; y: number; size: number };

export function certificateQrSettings(value: unknown, width: number, height: number): CertificateQrSettings {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const size = Math.min(Math.min(width, height), Math.max(64, Number(raw.size) || 160));
  return { visible: raw.visible === true, size, x: Math.min(width - size, Math.max(0, Number(raw.x) || 0)), y: Math.min(height - size, Math.max(0, Number(raw.y) || 0)) };
}

export function parseCertificateQr(data: FormData, width: number, height: number): CertificateQrSettings {
  const x = Number(data.get("qrX")), y = Number(data.get("qrY")), size = Number(data.get("qrSize"));
  if (![x, y, size].every(Number.isFinite) || size < Math.min(64, width, height) || size > Math.min(width, height) || x < 0 || y < 0 || x + size > width || y + size > height) throw new Error("موضع أو حجم QR خارج حدود الشهادة.");
  return { visible: data.get("qrVisible") === "on", x, y, size };
}
