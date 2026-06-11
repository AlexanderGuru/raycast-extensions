import { environment } from "@raycast/api";
import { existsSync, readdirSync, rmSync } from "fs";
import path from "path";

export const PHOTO_DIR = path.join(environment.supportPath, "photos");
const PHOTO_EXT = ".jpg";

/** Contact ids contain ":" (e.g. "…:ABPerson") — make them filename-safe. */
function safeId(contactId: string): string {
  return contactId.replace(/[^a-zA-Z0-9-]/g, "_");
}

/** Cached photo path for a contact, or undefined if it has none. */
export function cachedPhotoPath(contactId: string, cachedIds: Set<string>): string | undefined {
  const id = safeId(contactId);
  return cachedIds.has(id) ? path.join(PHOTO_DIR, id + PHOTO_EXT) : undefined;
}

/** Remove cached photos for contacts that no longer have one. */
export function cleanupStalePhotos(currentIds: Set<string>): void {
  let files: string[];
  try {
    files = readdirSync(PHOTO_DIR);
  } catch {
    return;
  }
  for (const file of files) {
    if (!file.endsWith(PHOTO_EXT)) continue;
    const id = file.slice(0, -PHOTO_EXT.length);
    if (!currentIds.has(id)) {
      const stale = path.join(PHOTO_DIR, file);
      if (existsSync(stale)) rmSync(stale, { force: true });
    }
  }
}
