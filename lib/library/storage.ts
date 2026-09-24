import { deletePrivateBlobs, getPrivateBlob, putPrivateBlob } from "@/lib/blob-storage";
import type { ValidatedLibraryFile } from "./file-validation";

export async function storeLibraryFile(file: ValidatedLibraryFile) {
  await putPrivateBlob(file.storageKey, file.buffer, file.mime);
  return file.storageKey;
}

export function readLibraryFile(storageKey: string) {
  return getPrivateBlob(storageKey, { useCache: false });
}

export function deleteLibraryFiles(storageKeys: string[]) {
  return deletePrivateBlobs(storageKeys);
}
