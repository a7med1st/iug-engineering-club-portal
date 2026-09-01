import type { GetBlobResult } from "@vercel/blob";
import {
  BlobStorageConfigurationError,
  getPublicBlob,
} from "@/lib/blob-storage";

export type DepartmentImageType = "profileImage" | "detailImage";

export interface StoredDepartmentImage {
  storedName?: string | null;
  originalName?: string | null;
  mime?: string | null;
  size?: number | null;
  updatedAt?: Date | null;
}

export class DepartmentImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DepartmentImageError";
  }
}

/**
 * Get public image URL for a department from Blob Storage
 */
export async function getDepartmentImageUrl(
  storedName: string | null | undefined
): Promise<string | null> {
  if (!storedName) {
    return null;
  }

  try {
    // If using Vercel Blob, construct the public URL
    if (process.env.BLOB_PUBLIC_ORIGIN) {
      return `${process.env.BLOB_PUBLIC_ORIGIN}/${storedName}`;
    }

    // For local storage, return the pathname
    return `${process.env.LOCAL_STORAGE_ROOT}/public/${storedName}`;
  } catch {
    return null;
  }
}

/**
 * Get the best available image for a department (profile or fallback)
 */
export async function getDepartmentDisplayImage(
  profileImage: StoredDepartmentImage | null | undefined,
  fallbackPath: string | null | undefined
): Promise<string> {
  // Try to use stored image first
  if (profileImage?.storedName) {
    const url = await getDepartmentImageUrl(profileImage.storedName);
    if (url) return url;
  }

  // Fallback to static image
  if (fallbackPath) {
    return fallbackPath;
  }

  // Last resort: placeholder
  return "/images/placeholder.png";
}
