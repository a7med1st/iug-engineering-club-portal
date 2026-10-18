export type CertificateLanguage = "ar" | "en";

export function certificateLanguage(value: string | null): CertificateLanguage | null {
  if (value === null || value === "" || value === "ar") return "ar";
  return value === "en" ? "en" : null;
}

export function certificateDownloadLanguage(value: string | null, certificate: { artifactPathname: string | null; englishArtifactPathname?: string | null }): CertificateLanguage | null {
  if (value) return certificateLanguage(value);
  return certificate.artifactPathname ? "ar" : certificate.englishArtifactPathname ? "en" : null;
}

export function certificateTemplateForm(data: FormData, language: CertificateLanguage) {
  const result = new FormData();
  result.set("activityId", String(data.get("activityId") ?? ""));
  const prefix = `${language}.`;
  for (const [key, value] of data.entries()) {
    if (key.startsWith(prefix)) result.append(key.slice(prefix.length), value);
  }
  return result;
}
