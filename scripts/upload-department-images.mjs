import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { putPublicBlob } from "@/lib/blob-storage";

const DEPARTMENTS_IMAGE_DIR = path.join(process.cwd(), "public/images/departments");

const departmentSlugs: Record<string, string> = {
  "ai": "ai",
  "architecture": "architecture",
  "civil": "civil",
  "computer": "computer",
  "electrical": "electrical",
  "industrial": "industrial",
  "intelligent-systems": "intelligent-systems",
  "mechanical": "mechanical",
  "smart-systems": "smart-systems",
};

async function uploadDepartmentImages() {
  console.log("🖼️  Starting department profile images upload...\n");

  try {
    const files = await readdir(DEPARTMENTS_IMAGE_DIR);
    const profileImages = files.filter((f) => f.includes("-profile.png"));

    for (const filename of profileImages) {
      const filepath = path.join(DEPARTMENTS_IMAGE_DIR, filename);
      const buffer = await readFile(filepath);

      // Extract department slug from filename
      const slug = filename.replace("-profile.png", "");

      if (!departmentSlugs[slug]) {
        console.warn(`⚠️  Unknown department slug: ${slug}, skipping...`);
        continue;
      }

      const department = await prisma.department.findUnique({
        where: { slug },
      });

      if (!department) {
        console.warn(`⚠️  Department not found: ${slug}, skipping...`);
        continue;
      }

      try {
        // Upload to Blob Storage
        const pathname = `departments/${slug}/profile-${Date.now()}.png`;
        const blob = await putPublicBlob(pathname, buffer, "image/png");

        // Update database
        await prisma.department.update({
          where: { id: department.id },
          data: {
            profileImageStoredName: blob.pathname,
            profileImageOriginalName: filename,
            profileImageMime: "image/png",
            profileImageSize: buffer.length,
            profileImageUpdatedAt: new Date(),
          },
        });

        console.log(`✅ ${slug}: ${filename} uploaded successfully`);
      } catch (error) {
        console.error(`❌ Failed to upload ${filename}:`, error);
      }
    }

    console.log("\n✨ Department profile images upload completed!\n");
  } catch (error) {
    console.error("❌ Error uploading department images:", error);
    process.exit(1);
  }
}

await uploadDepartmentImages().finally(() => process.exit(0));
