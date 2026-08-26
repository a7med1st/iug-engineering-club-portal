import { del, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const CHAT_ATTACHMENT_MAX_BYTES = 12 * 1024 * 1024;

export class ChatAttachmentStorageError extends Error {}

export type StoredChatAttachment = {
  url: string | null;
  pathname: string;
  originalName: string;
  mime: string;
  size: number;
};

const safeOriginalName = (name: string) =>
  name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180) || "attachment";

export async function uploadChatAttachment(
  file: File,
  conversationId: string,
): Promise<StoredChatAttachment> {
  if (!(file instanceof File) || file.size === 0) {
    throw new ChatAttachmentStorageError("اختر ملفًا صالحًا للرفع.");
  }

  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new ChatAttachmentStorageError("حجم الملف أكبر من الحد المسموح وهو 12 ميجابايت.");
  }

  const originalName = safeOriginalName(file.name);
  const mime = file.type.slice(0, 120) || "application/octet-stream";
  const key = `${randomUUID()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const pathname = `chat-attachments/${conversationId}/${key}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: mime,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
      originalName,
      mime,
      size: file.size,
    };
  }

  const target = path.join(process.cwd(), "storage", pathname);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));

  return { url: null, pathname, originalName, mime, size: file.size };
}

export async function deleteChatAttachment(
  attachment: Pick<StoredChatAttachment, "url" | "pathname">,
) {
  if (!attachment.pathname.startsWith("chat-attachments/")) return;

  if (attachment.url && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(attachment.pathname);
    return;
  }

  const target = path.join(process.cwd(), "storage", attachment.pathname);
  await unlink(target).catch(() => undefined);
}
