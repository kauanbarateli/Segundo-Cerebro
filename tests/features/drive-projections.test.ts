import { describe, expect, it } from "vitest";
import { folderTrail, formatFileBytes, projectDrive } from "../../src/components/features/drive/projections";
import { createModuleFixture, emptyModuleFixture } from "../../src/lib/demo/module-fixtures";

const fixture = () => createModuleFixture("2026-09-23T17:00:00Z").drive;
describe("Drive de exemplo", () => {
  it("raiz e lixeira projetam as mesmas entidades sem duplicar arquivos ou uso", () => {
    const data = fixture();
    const root = projectDrive(data, null, false), trash = projectDrive(data, null, true);
    expect(root.visibleFolders.map((folder) => folder.id)).toEqual(["documents", "projects", "images"]);
    expect(root.visibleFiles).toHaveLength(4); expect(trash.visibleFiles).toHaveLength(1);
    expect(trash.visibleFiles[0]).toBe(data.files.find((file) => file.id === "file-old-draft"));
    expect(root.usedBytes).toBe(2_183_987); expect(trash.usedBytes).toBe(root.usedBytes);
    expect(root.trashCount).toBe(1); expect(root.fileCount).toBe(4);
  });
  it("resolve ancestrais por ID e limita a pasta aos próprios arquivos", () => {
    const data = fixture(), view = projectDrive(data, "sc-v2", false);
    expect(view.trail?.map((folder) => folder.id)).toEqual(["projects", "sc-v2"]);
    expect(view.visibleFiles.map((file) => file.id)).toEqual(["file-backup", "file-logo"]);
    expect(projectDrive(data, "projects", false).visibleFiles).toEqual([]);
    expect(projectDrive(data, "projects", false).visibleFolders.map((folder) => folder.id)).toEqual(["sc-v2"]);
  });
  it("caminho ausente, excluído ou cíclico não vira navegação válida", () => {
    const data = fixture();
    expect(folderTrail(data.folders, "__proto__")).toBeNull();
    expect(folderTrail(data.folders, "constructor")).toBeNull();
    data.folders.find((folder) => folder.id === "projects")!.parent_id = "sc-v2";
    expect(folderTrail(data.folders, "sc-v2")).toBeNull();
    data.folders.find((folder) => folder.id === "projects")!.parent_id = null;
    data.folders.find((folder) => folder.id === "projects")!.deleted_at = "2026-09-23T17:00:00Z";
    expect(folderTrail(data.folders, "sc-v2")).toBeNull();
    expect(projectDrive(data, null, false).visibleFiles.map((file) => file.id)).not.toContain("file-logo");
  });
  it("ordem recente usa instantes e desempata por ID sem mutar os registros", () => {
    const data = fixture();
    data.files[0]!.modified_at = "2026-09-24T01:00:00+03:00";
    data.files[1]!.modified_at = "2026-09-23T23:00:00Z";
    const before = structuredClone(data);
    expect(projectDrive(data, null, false).visibleFiles.slice(0, 2).map((file) => file.id)).toEqual(["file-logo", "file-contract"]);
    expect(data).toEqual(before);
  });
  it("vazio real preserva capacidade, com contadores zerados", () => {
    const view = projectDrive(emptyModuleFixture().drive, null, false);
    expect(view).toEqual({ trail: [], visibleFolders: [], visibleFiles: [], usedBytes: 0, trashCount: 0, fileCount: 0 });
  });
  it("formata a cota em GB e mantém precisão útil nos arquivos pequenos", () => {
    expect(formatFileBytes(0)).toBe("0 B"); expect(formatFileBytes(512)).toBe("512 B");
    expect(formatFileBytes(8192)).toBe("8 KB"); expect(formatFileBytes(1258291)).toBe("1,2 MB");
    expect(formatFileBytes(1024 ** 3)).toBe("1 GB");
  });
});
