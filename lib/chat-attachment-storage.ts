import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";

import {
  deletePrivateBlobs,
  deletePublicBlobs,
  putPrivateBlob,
} from "@/lib/blob-storage";
import {
  UploadValidationError,
  type UploadCategory,
  logUploadRejection,
  validateChatUpload,
} from "@/lib/upload-security";

export const CHAT_ATTACHMENT_MAX_BYTES = 12 * 1024 * 1024;

export class ChatAttachmentStorageError extends Error {}

export type StoredChatAttachment = {
  url: string | null;
  pathname: string;
  originalName: string;
  mime: string;
  size: number;
  category: UploadCategory;
};

export async function uploadChatAttachment(
  file: File,
  conversationId: string,
): Promise<StoredChatAttachment> {
  let validated;

  try {
    validated = await validateChatUpload(file, CHAT_ATTACHMENT_MAX_BYTES);
  } catch (error) {
    logUploadRejection("chat", error, { size: file.size, mime: file.type });
    throw new ChatAttachmentStorageError(
      error instanceof UploadValidationError
        ? error.message
        : "تعذر التحقق من الملف المرفق.",
    );
  }

  const pathname =
    `chat-attachments/${conversationId}/${randomUUID()}${validated.extension}`;

  try {
    const blob = await putPrivateBlob(pathname, validated.buffer, validated.mime);

    return {
      url: null,
      pathname: blob.pathname,
      originalName: validated.originalName,
      mime: validated.mime,
      size: validated.size,
      category: validated.category,
    };
  } catch (error) {
    console.error("Chat attachment storage failed", {
      conversationId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw new ChatAttachmentStorageError("تخزين المرفقات الخاصة غير مهيأ أو غير متاح.");
  }
}

export async function deleteChatAttachment(
  attachment: Pick<StoredChatAttachment, "url" | "pathname">,
) {
  if (!attachment.pathname.startsWith("chat-attachments/")) return;

  if (attachment.url) {
    await deletePublicBlobs([attachment.pathname]);
    return;
  }

  try {
    await deletePrivateBlobs([attachment.pathname]);
    return;
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
  }

  const storageRoot = path.resolve(process.cwd(), "storage");
  const target = path.resolve(storageRoot, attachment.pathname);
  if (target.startsWith(`${storageRoot}${path.sep}`)) {
    await unlink(target).catch(() => undefined);
  }
}

export async function tryDeleteChatAttachment(
  attachment: Pick<StoredChatAttachment, "url" | "pathname">,
  context: string,
) {
  try {
    await deleteChatAttachment(attachment);
  } catch (error) {
    console.error("Chat attachment cleanup failed", {
      context,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
