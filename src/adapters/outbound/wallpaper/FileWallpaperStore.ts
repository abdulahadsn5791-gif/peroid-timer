import { Directory, File, Paths } from "expo-file-system";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";

const PREVIEW_PREFIX = "wallpaper-preview-";
const STORED_PREFIX = "wallpaper-";

function previewDir(): Directory {
  return new Directory(Paths.cache);
}

function storedDir(): Directory {
  return new Directory(Paths.document);
}

function stampOf(file: File): number {
  const match = /-(\d+)\.jpg$/.exec(file.name);
  if (match) return Number(match[1]);
  return file.modificationTime ?? 0;
}

function listByPrefix(dir: Directory, prefix: string): File[] {
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((entry) => entry instanceof File && entry.name.startsWith(prefix))
    .map((entry) => entry as File)
    .sort((a, b) => stampOf(a) - stampOf(b));
}

/** Newest matching file, or null. */
function newest(dir: Directory, prefix: string): File | null {
  const files = listByPrefix(dir, prefix);
  return files.length ? files[files.length - 1] : null;
}

function deleteAll(dir: Directory, prefix: string): void {
  for (const file of listByPrefix(dir, prefix)) {
    try {
      if (file.exists) file.delete();
    } catch {
      // file already gone; ignore
    }
  }
}

/** One-time rename of the old fixed-name files (pre-versioning builds). */
function migrateLegacy(): void {
  const legacyStored = new File(Paths.document, "wallpaper.jpg");
  if (legacyStored.exists) {
    try {
      legacyStored.move(new File(Paths.document, `${STORED_PREFIX}${Date.now()}.jpg`));
    } catch {
      // ignore rename failure; the old file still resolves via a best-effort read below
    }
  }
  const legacyPreview = new File(Paths.cache, "wallpaper-preview.jpg");
  if (legacyPreview.exists) {
    try {
      legacyPreview.move(new File(Paths.cache, `${PREVIEW_PREFIX}${Date.now()}.jpg`));
    } catch {
      // ignore
    }
  }
}

/**
 * Wallpaper image lifecycle with expo-file-system (new API): the picked image
 * is first copied to a cache "preview" file; Save promotes it to a new
 * versioned file in the document directory, Close/Remove deletes it. Every
 * write uses a unique filename so the app's `<Image>` gets a fresh URI — a
 * fixed-name file would stay cached by RN/Fresco and look like "the wallpaper
 * is not changing". File content is never stored in settings.
 */
export class FileWallpaperStore implements WallpaperStorePort {
  getStoredUri(): string | null {
    migrateLegacy();
    return newest(storedDir(), STORED_PREFIX)?.uri ?? null;
  }

  hasPreview(): boolean {
    migrateLegacy();
    return newest(previewDir(), PREVIEW_PREFIX) != null;
  }

  async setPreviewImage(sourceUri: string): Promise<string | null> {
    try {
      migrateLegacy();
      deleteAll(previewDir(), PREVIEW_PREFIX);
      const destination = new File(Paths.cache, `${PREVIEW_PREFIX}${Date.now()}.jpg`);
      await new File(sourceUri).copy(destination);
      return destination.exists ? destination.uri : null;
    } catch {
      return null;
    }
  }

  clearPreview(): void {
    deleteAll(previewDir(), PREVIEW_PREFIX);
  }

  async commitPreview(): Promise<string | null> {
    migrateLegacy();
    const preview = newest(previewDir(), PREVIEW_PREFIX);
    if (!preview) return this.getStoredUri();
    try {
      const stored = new File(Paths.document, `${STORED_PREFIX}${Date.now()}.jpg`);
      deleteAll(storedDir(), STORED_PREFIX);
      await preview.copy(stored);
      this.clearPreview();
      return stored.exists ? stored.uri : null;
    } catch {
      return null;
    }
  }

  rollbackPreview(): void {
    this.clearPreview();
  }

  async removeStored(): Promise<void> {
    migrateLegacy();
    deleteAll(storedDir(), STORED_PREFIX);
    const legacy = new File(Paths.document, "wallpaper.jpg");
    if (legacy.exists) legacy.delete();
  }
}