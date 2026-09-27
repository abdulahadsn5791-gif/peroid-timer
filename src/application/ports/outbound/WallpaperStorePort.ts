/**
 * Owns the wallpaper image lifecycle: a committed file plus an optional
 * preview copy that "saving" either promotes or "closing" deletes.
 */
export interface WallpaperStorePort {
  getStoredUri(): string | null;
  hasPreview(): boolean;
  /** Copies a picked image into the preview slot; returns its uri or null. */
  setPreviewImage(sourceUri: string): Promise<string | null>;
  clearPreview(): void;
  /** Promotes the preview to the committed file; returns the stored uri. */
  commitPreview(): Promise<string | null>;
  rollbackPreview(): void;
  removeStored(): Promise<void>;
}