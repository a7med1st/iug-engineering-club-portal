import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPrivateBlob } from "@/lib/blob-storage";
import { privateFileResponse } from "@/lib/private-file-response";
import { canViewCertificate, isCertificateValid, normalizeCertificateCode } from "@/lib/certificates";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const auth = await getCurrentUser();
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const certificate = await prisma.certificate.findUnique({ where: { verificationCode: normalizeCertificateCode(code) }, select: { artifactPathname: true, artifactMime: true, revokedAt: true, submission: { select: { userId: true, status: true, checkedInAt: true } } } });
  if (!certificate) return new Response("Not found", { status: 404 });
  if (!canViewCertificate(auth.user, certificate.submission.userId)) return new Response("Forbidden", { status: 403 });
  if (!isCertificateValid(certificate)) return new Response("Not found", { status: 404 });
  const result = await getPrivateBlob(certificate.artifactPathname!);
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  return privateFileResponse(result, { fallbackMime: certificate.artifactMime ?? "image/png", originalName: `certificate-${code}.png`, disposition: inline ? "inline" : "attachment", cacheControl: "private, no-store" }) ?? new Response("Not found", { status: 404 });
}
