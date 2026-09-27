import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";

export class InMemoryWallpaperStore implements WallpaperStorePort {
  storedUri: string | null = null;
  previewUri: string | null = null;

  constructor(storedUri: string | null = null) {
    this.storedUri = storedUri;
  }

  getStoredUri(): string | null {
    return this.storedUri;
  }

  hasPreview(): boolean {
    return this.previewUri != null;
  }

  async setPreviewImage(sourceUri: string): Promise<string | null> {
    this.previewUri = sourceUri;
    return sourceUri;
  }

  clearPreview(): void {
    this.previewUri = null;
  }

  async commitPreview(): Promise<string | null> {
    if (this.previewUri != null) {
      this.storedUri = this.previewUri;
      this.previewUri = null;
    }
    return this.storedUri;
  }

  rollbackPreview(): void {
    this.previewUri = null;
  }

  async removeStored(): Promise<void> {
    this.storedUri = null;
  }
}