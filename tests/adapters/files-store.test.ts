import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { executarDrive, type SnapshotDrive } from "../../src/core/drive";
import { createDriveStore, FilesCommitUnknown, type DriveGateway } from "../../src/adapters/db/files-store";
const user = "10000000-0000-4000-8000-000000000001", folder = "10000000-0000-4000-8000-000000000002", now = "2026-10-09T14:00:00Z";
const empty = (): SnapshotDrive => ({ revision: "0", folders: [], files: [], projects: [], receipts: [], usage_bytes: 0, capacity_bytes: 10000, max_file_bytes: 1000 });
const deps = { clock: { now: () => now }, ids: { next: () => folder } }, context = { user_id: user, canal: "web" as const }, request = { command: "drive.folder.create" as const, input: { name: "Documentos", client_id: "stable" } };
describe("Drive CAS staging", () => {
  it("reconcilia resposta perdida via recibo sem publicar lote duas vezes", async () => {
    let saved: Parameters<DriveGateway["commit"]>[0]["receipt"] | null = null;
    const commit = vi.fn<DriveGateway["commit"]>(async value => { expect(value.changes).toHaveLength(1); expect(value.events).toHaveLength(1); expect(value.events[0]?.entity_type).toBe("drive_folder"); saved = value.receipt; throw new FilesCommitUnknown(); });
    const result = await executarDrive(createDriveStore({ actorId: user, snapshot: async () => empty(), commit, receipt: async () => saved }), deps, context, request);
    expect(result).toMatchObject({ id: folder, name: "Documentos" }); expect(commit).toHaveBeenCalledTimes(1);
  });
  it("reexecuta conflito CAS e preserva falha incerta sem recibo", async () => {
    const commit = vi.fn<DriveGateway["commit"]>().mockResolvedValueOnce({ status: "stale" }).mockImplementation(async value => ({ status: "committed", result: value.receipt.result }));
    const gateway: DriveGateway = { actorId: user, snapshot: async () => empty(), commit, receipt: async () => null };
    await expect(executarDrive(createDriveStore(gateway), deps, context, request)).resolves.toMatchObject({ name: "Documentos" }); expect(commit).toHaveBeenCalledTimes(2);
    commit.mockImplementation(async () => { throw new FilesCommitUnknown(); }); await expect(executarDrive(createDriveStore(gateway), deps, context, request)).rejects.toBeInstanceOf(FilesCommitUnknown);
  });
  it("recusa mutação sem evento e remoção física antes do RPC", async () => {
    const commit = vi.fn<DriveGateway["commit"]>(); const gateway: DriveGateway = { actorId: user, snapshot: async () => empty(), commit, receipt: async () => null };
    await expect(createDriveStore(gateway).transaction(context, async tx => {
      tx.state.folders.push({ id: folder, user_id: user, name: "X", parent_id: null, project_id: null, position: 0, created_at: now, updated_at: now, deleted_at: null, deletion_batch_id: null });
      tx.state.receipts.push({ user_id: user, command: request.command, client_id: "manual", fingerprint: "f", result: null }); return null;
    })).rejects.toMatchObject({ code: "EVENT_REQUIRED" }); expect(commit).not.toHaveBeenCalled();
  });
});
