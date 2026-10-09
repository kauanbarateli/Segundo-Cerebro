import { describe, expect, it } from "vitest";
import { executarDrive, driveDTO, nomeSeguroArquivo, tipoPelosBytes, validarEntradaArquivo, validarSnapshotDrive, type Arquivo, type ComandoDrive, type DriveStore, type EventoDrive, type SnapshotDrive } from "../../src/core/drive";
const user = "10000000-0000-4000-8000-000000000001", now = "2026-10-09T14:00:00Z";
const file = (id: string, folder_id: string | null = null): Arquivo => ({ id, user_id: user, folder_id, kind: "drive", name: "Documento.pdf", mime: "application/pdf", bytes: 100, sha256: "a".repeat(64), width: null, height: null, starred: false, deleted_at: null, deletion_batch_id: null, created_at: now, updated_at: now, modified_at: now });
function fixture() {
  let state: SnapshotDrive = { revision: "0", folders: [], files: [], projects: [], receipts: [], usage_bytes: 0, capacity_bytes: 1000, max_file_bytes: 500 };
  let sequence = 10; const events: EventoDrive[] = [];
  const store: DriveStore = { snapshot: async () => structuredClone(state), transaction: async (_context, work) => { const tx = { state: structuredClone(state), events: [] as EventoDrive[] }; const result = await work(tx); state = tx.state; events.push(...tx.events); return result; } };
  const command = (request: ComandoDrive) => executarDrive(store, { clock: { now: () => now }, ids: { next: () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}` } }, { user_id: user, canal: "web" }, request);
  const folder = (name: string, parent_id: string | null = null) => command({ command: "drive.folder.create", input: { name, parent_id, client_id: name } });
  return { state: () => state, command, folder, events };
}
describe("Drive: árvore e lixeira", () => {
  it("recusa mover uma pasta para si ou descendente e preserva estado", async () => {
    const f = fixture(), parent = await f.folder("Pai"), child = await f.folder("Filho", parent.id);
    for (const id of [parent.id, child.id]) await expect(f.command({ command: "drive.folder.move", input: { id: parent.id, parent_id: id, client_id: id } })).rejects.toThrow("descendente");
    expect(f.state().folders[0]?.parent_id).toBeNull();
  });
  it("restaura exatamente o lote da pasta, preservando itens excluídos antes", async () => {
    const f = fixture(), parent = await f.folder("Pai"), child = await f.folder("Filho", parent.id);
    f.state().files.push(file("first", child.id), file("earlier", child.id));
    await f.command({ command: "drive.file.delete", input: { id: "earlier", client_id: "earlier" } });
    const previous = f.state().files[1]?.deletion_batch_id;
    await f.command({ command: "drive.folder.delete", input: { id: parent.id, client_id: "tree" } });
    const batch = f.state().folders[0]?.deletion_batch_id;
    expect(f.state().folders[1]?.deletion_batch_id).toBe(batch); expect(f.state().files[0]?.deletion_batch_id).toBe(batch); expect(f.state().files[1]?.deletion_batch_id).toBe(previous);
    await f.command({ command: "drive.folder.restore", input: { id: parent.id, client_id: "restore" } });
    expect(f.state().folders.every(item => !item.deleted_at)).toBe(true); expect(f.state().files[0]?.deleted_at).toBeNull(); expect(f.state().files[1]?.deleted_at).toBe(now);
  });
  it("não restaura arquivo enquanto a pasta está excluída", async () => {
    const f = fixture(), parent = await f.folder("Pai"); f.state().files.push(file("f", parent.id));
    await f.command({ command: "drive.folder.delete", input: { id: parent.id, client_id: "delete" } });
    await expect(f.command({ command: "drive.file.restore", input: { id: "f", client_id: "restore" } })).rejects.toThrow("destino");
  });
  it("replay não duplica eventos e reutilizar client_id muda para conflito", async () => {
    const f = fixture(), request: ComandoDrive = { command: "drive.folder.create", input: { name: "Caderno.js", client_id: "same" } };
    const first = await f.command(request); expect(await f.command(request)).toEqual(first); expect(f.events).toHaveLength(1);
    await expect(f.command({ ...request, input: { ...request.input, name: "Outro" } })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("DTO não revela anexos, mas mantém quota calculada no servidor", () => {
    const f = fixture(); f.state().files.push(file("drive"), { ...file("image"), kind: "capture_image", mime: "image/png", width: 20, height: 20 }); f.state().usage_bytes = 200;
    expect(driveDTO(f.state()).files.map(item => item.id)).toEqual(["drive"]); expect(driveDTO(f.state()).usage_bytes).toBe(200);
    expect(() => validarSnapshotDrive({ ...f.state(), files: [{ ...file("foreign"), user_id: "another" }] }, user)).toThrow("usuário");
  });
});
describe("Drive: conteúdo medido", () => {
  it.each(["program.exe", "page.html", "vector.svg", "script.js", "../escape.txt", "a\\b.txt"])("recusa nomes ativos e caminhos: %s", name => expect(() => nomeSeguroArquivo(name)).toThrow());
  it.each([[0x4d, 0x5a], [0x7f, 0x45, 0x4c, 0x46], [0x23, 0x21], [0xca, 0xfe, 0xba, 0xbe]].map(bytes => ({ bytes })))("recusa executável renomeado %#", ({ bytes }) => expect(tipoPelosBytes(new Uint8Array(bytes))).toBeNull());
  it("aceita PDF e texto UTF8 pela assinatura, rejeita HTML e binário desconhecido", () => {
    expect(tipoPelosBytes(new TextEncoder().encode("%PDF-1.7 test"))).toBe("application/pdf"); expect(tipoPelosBytes(new TextEncoder().encode("Ação e memória"))).toBe("text/plain");
    expect(tipoPelosBytes(new TextEncoder().encode("<html>active"))).toBeNull(); expect(tipoPelosBytes(new Uint8Array([0, 234, 255]))).toBeNull();
    expect(() => validarEntradaArquivo("avatar", "foto.png", new TextEncoder().encode("texto"), 800)).toThrow("imagem");
  });
});
