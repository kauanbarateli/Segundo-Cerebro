import type { DemoQueries } from "../../../lib/demo/types";

type DriveData = DemoQueries["drive"];
type Folder = DriveData["folders"][number];

export function formatFileBytes(bytes: number): string {
  const value = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = value ? Math.max(0, Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)) : 0;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: index ? 1 : 0 }).format(value / 1024 ** index)} ${units[index]}`;
}

/** Invalid, deleted or cyclic ancestry never becomes a valid folder location. */
export function folderTrail(folders: readonly Folder[], id: string | null): Folder[] | null {
  const trail: Folder[] = [], seen = new Set<string>();
  let current = id;
  while (current !== null) {
    const folder = folders.find((item) => item.id === current && !item.deleted_at);
    if (!folder || seen.has(current)) return null;
    seen.add(current); trail.unshift(folder); current = folder.parent_id;
  }
  return trail;
}

export function projectDrive(data: DriveData, folderId: string | null, trash: boolean) {
  const trail = trash ? [] : folderTrail(data.folders, folderId);
  const visibleFolders = data.folders.filter((folder) => trash ? !!folder.deleted_at : !folder.deleted_at && folder.parent_id === folderId && folderTrail(data.folders, folder.id) !== null);
  const visibleFiles = data.files.filter((file) => trash ? !!file.deleted_at : !file.deleted_at && folderTrail(data.folders, file.folder_id) !== null && (folderId === null || file.folder_id === folderId))
    .sort((first, second) => Date.parse(second.modified_at) - Date.parse(first.modified_at) || first.id.localeCompare(second.id));
  return {
    trail, visibleFolders, visibleFiles,
    usedBytes: data.files.reduce((total, file) => total + file.bytes, 0),
    trashCount: data.files.filter((file) => !!file.deleted_at).length + data.folders.filter((folder) => !!folder.deleted_at).length,
    fileCount: data.files.filter((file) => !file.deleted_at && folderTrail(data.folders, file.folder_id) !== null).length,
  };
}
