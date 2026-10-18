import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPrivateBlob } from "@/lib/blob-storage";
import { privateFileResponse } from "@/lib/private-file-response";
import { canViewCertificate, isCertificateValid, normalizeCertificateCode } from "@/lib/certificates";
import { certificateLanguage } from "@/lib/certificate-language";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const auth = await getCurrentUser();
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const certificate = await prisma.certificate.findUnique({
    where: { verificationCode: normalizeCertificateCode(code) },
    select: {
      artifactPathname: true,
      artifactMime: true,
      englishArtifactPathname: true,
      englishArtifactMime: true,
      revokedAt: true,
      submission: {
        select: {
          userId: true,
          status: true,
          checkedInAt: true,
          sessionAttendances: { select: { sessionId: true } },
          form: {
            select: {
              activity: {
                select: { requiredAttendanceCount: true, sessions: { select: { id: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!certificate) return new Response("Not found", { status: 404 });
  if (!canViewCertificate(auth.user, certificate.submission.userId)) return new Response("Forbidden", { status: 403 });
  if (!isCertificateValid(certificate)) return new Response("Not found", { status: 404 });
  const language = certificateLanguage(new URL(request.url).searchParams.get("language"));
  if (!language) return new Response("Invalid language", { status: 400 });
  const pathname = language === "en" ? certificate.englishArtifactPathname : certificate.artifactPathname;
  if (!pathname) return new Response("Not found", { status: 404 });
  const mime = language === "en" ? certificate.englishArtifactMime : certificate.artifactMime;
  const result = await getPrivateBlob(pathname);
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  return privateFileResponse(result, { fallbackMime: mime ?? "image/png", originalName: `certificate-${code}-${language}.png`, disposition: inline ? "inline" : "attachment", cacheControl: "private, no-store" }) ?? new Response("Not found", { status: 404 });
}
