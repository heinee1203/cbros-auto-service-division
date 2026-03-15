import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";

// Generate a simple unique ID (don't need cuid here, just timestamp + random)
function uniqueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string;
    const entityId = formData.get("entityId") as string;
    const stage = formData.get("stage") as string;
    const category = formData.get("category") as string | null;
    const jobOrderNumber = formData.get("jobOrderNumber") as string | null;

    if (!file || !entityType || !entityId || !stage) {
      return NextResponse.json(
        { error: "Missing required fields: file, entityType, entityId, stage" },
        { status: 400 }
      );
    }

    const uid = uniqueId();
    const ext = path.extname(file.name) || ".jpg";
    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure directories exist
    const baseDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(path.join(baseDir, "originals"), { recursive: true });
    await fs.mkdir(path.join(baseDir, "full"), { recursive: true });
    await fs.mkdir(path.join(baseDir, "thumbs"), { recursive: true });

    // 1. Save original at full resolution
    const originalFilename = `original_${uid}${ext}`;
    const originalPath = path.join(baseDir, "originals", originalFilename);
    await fs.writeFile(originalPath, buffer);

    // 2. Get image metadata
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // 3. Generate full-size optimized (2000px max, 85% quality)
    const fullFilename = `full_${uid}.jpg`;
    const fullPath = path.join(baseDir, "full", fullFilename);

    // 4. Burn watermark on full-size (timestamp + shop name + JO number)
    const now = new Date();
    const watermarkText = [
      now.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Manila",
      }),
      now.toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      }),
      "AutoServ Pro Intake",
      jobOrderNumber || "",
    ]
      .filter(Boolean)
      .join(" \u2022 ");

    // Create watermark SVG overlay
    const resizedMeta = await sharp(buffer)
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .metadata();
    const ww = resizedMeta.width || 2000;
    const wh = resizedMeta.height || 2000;

    const watermarkSvg = `
      <svg width="${ww}" height="${wh}">
        <rect x="0" y="${wh - 36}" width="${ww}" height="36" fill="rgba(0,0,0,0.5)"/>
        <text x="${ww - 10}" y="${wh - 12}" font-family="monospace" font-size="14" fill="rgba(255,255,255,0.85)" text-anchor="end">${watermarkText}</text>
      </svg>
    `;

    await sharp(buffer)
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .composite([{ input: Buffer.from(watermarkSvg), top: 0, left: 0 }])
      .jpeg({ quality: 85 })
      .toFile(fullPath);

    // 5. Generate thumbnail (300px, 75% quality)
    const thumbFilename = `thumb_${uid}.jpg`;
    const thumbPath = path.join(baseDir, "thumbs", thumbFilename);
    await sharp(buffer)
      .resize(300, 300, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toFile(thumbPath);

    // 6. Create Photo record in database
    const photo = await prisma.photo.create({
      data: {
        entityType,
        entityId,
        stage,
        category: category || null,
        fileName: file.name,
        originalPath: `/uploads/originals/${originalFilename}`,
        fullSizePath: `/uploads/full/${fullFilename}`,
        thumbnailPath: `/uploads/thumbs/${thumbFilename}`,
        mimeType: file.type || "image/jpeg",
        fileSizeBytes: buffer.length,
        width,
        height,
        takenAt: now,
        uploadedBy: session.user.id,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      },
    });

    return NextResponse.json({
      id: photo.id,
      thumbnailPath: photo.thumbnailPath,
      fullSizePath: photo.fullSizePath,
      originalPath: photo.originalPath,
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json(
      { error: "Failed to process photo" },
      { status: 500 }
    );
  }
}
