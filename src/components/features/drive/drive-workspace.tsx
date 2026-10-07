"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDemoQuery } from "@/lib/demo/demo-provider";
import type { DemoQueries } from "@/lib/demo/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ProgressBar } from "@/components/ui/data-display";
import { Icons } from "@/components/ui/icons";
import { FUSO_DO_APP } from "@/core/tempo";
import { formatFileBytes, projectDrive } from "./projections";
import "./drive.css";

type DriveFile = DemoQueries["drive"]["files"][number];
const dateText = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_DO_APP, dateStyle: "short" }).format(new Date(value));
export function DriveSkeleton() {
  return <div className="drive-skeleton" role="status" aria-label="Carregando Drive"><div className="drive-skeleton-breadcrumb" aria-hidden="true" /><div className="drive-skeleton-summary" aria-hidden="true"><div className="drive-skeleton-folders">{[0, 1, 2].map((value) => <i key={value} />)}</div><i className="drive-skeleton-usage" /></div><div className="drive-skeleton-files" aria-hidden="true">{[0, 1, 2, 3].map((value) => <i key={value} />)}</div></div>;
}
export function DriveWorkspace() {
  const query = useDemoQuery("drive"), params = useSearchParams();
  const folderId = params.get("folder"), trash = params.get("view") === "trash";
  const [fileId, setFileId] = useState<string | null>(null);
  if (query.status === "error") return <Card className="drive-message" data-access="allowed"><h2>Não foi possível abrir o Drive</h2><p role="alert">{query.error}</p><Button onClick={query.retry}>Tentar de novo</Button></Card>;
  if (!query.data) return <DriveSkeleton />;
  const data = query.data, view = projectDrive(data, folderId, trash);
  const selectedFile = view.visibleFiles.find((file) => file.id === fileId);
  const selectedFolder = view.trail?.at(-1);
  if (!view.trail) return <Card className="drive-message" data-access="allowed"><h2>Pasta não encontrada</h2><p>Esse caminho não está disponível na coleção de exemplo.</p><Link href="/drive">Voltar ao Meu Drive</Link></Card>;
  const columns: DataTableColumn<DriveFile>[] = [
    { id: "name", header: "Nome", accessor: (file) => file.name, render: (file) => <Button variant="ghost" className="drive-file-name" onClick={() => setFileId(file.id)}><Icons.File />{file.name}</Button> },
    { id: "size", header: "Tamanho", accessor: (file) => file.bytes, render: (file) => <span className="drive-size">{formatFileBytes(file.bytes)}</span> },
    { id: "modified", header: "Modificado", accessor: (file) => dateText(file.modified_at), sortable: false },
    { id: "starred", header: "Destaque", accessor: (file) => file.starred ? "Destacado" : "Sem destaque", render: (file) => file.starred ? <span className="drive-starred"><Icons.Star />Destacado</span> : "Sem destaque" },
  ];
  return <div className="drive-workspace" data-access="allowed" aria-busy={query.status === "loading" || undefined}>
    <div className="drive-top"><nav className="drive-breadcrumb" aria-label="Caminho da pasta"><Link href="/drive" aria-current={!folderId && !trash ? "page" : undefined}>Meu Drive</Link>{trash ? <><span className="drive-breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">Lixeira</span></> : view.trail.map((folder) => <Fragment key={folder.id}><span className="drive-breadcrumb-separator" aria-hidden="true">/</span><Link href={"/drive?folder=" + encodeURIComponent(folder.id)} aria-current={folder.id === folderId ? "page" : undefined}>{folder.name}</Link></Fragment>)}</nav><Link className="drive-trash-link" href={trash ? "/drive" : "/drive?view=trash"}>{trash ? "Voltar aos arquivos" : `Lixeira · ${view.trashCount}`}</Link></div>
    <p className="drive-note">{trash ? "Lixeira de exemplo. Mover, restaurar e excluir arquivos serão disponibilizados em uma próxima etapa." : "Arquivos de exemplo para explorar a organização. Estes registros mostram metadados, sem envio ou download de conteúdo."}</p>
    <div className="drive-summary"><Card className="drive-folders"><h2>{trash ? "Pastas na lixeira" : "Pastas"}</h2>{view.visibleFolders.length ? <ul>{view.visibleFolders.map((folder) => <li key={folder.id}>{trash ? <div className="drive-folder"><Icons.Folder /><strong>{folder.name}</strong></div> : <Link className="drive-folder" href={"/drive?folder=" + encodeURIComponent(folder.id)}><Icons.Folder /><div><strong>{folder.name}</strong><span>{data.files.filter((file) => file.folder_id === folder.id && !file.deleted_at).length} arquivos · {data.folders.filter((child) => child.parent_id === folder.id && !child.deleted_at).length} pastas</span></div></Link>}</li>)}</ul> : <p>{trash ? "Nenhuma pasta na lixeira." : "Nenhuma subpasta neste local."}</p>}</Card>
      <Card className="drive-usage"><h2>Uso do exemplo</h2><p><strong>{formatFileBytes(view.usedBytes)}</strong> de {formatFileBytes(data.capacity_bytes)}</p><ProgressBar label="Espaço usado" value={view.usedBytes} max={data.capacity_bytes} valueText={formatFileBytes(view.usedBytes) + " de " + formatFileBytes(data.capacity_bytes)} /><p className="drive-note">{view.fileCount} arquivos ativos. O espaço inclui os arquivos da lixeira.</p></Card></div>
    <Card className="drive-files"><h2>{trash ? "Arquivos na lixeira" : selectedFolder?.name ?? "Arquivos recentes"}</h2><DataTable key={`${trash ? "trash" : "files"}:${folderId ?? "root"}`} label={trash ? "Arquivos na lixeira" : "Arquivos de exemplo"} rows={view.visibleFiles} columns={columns} getRowId={(file) => file.id} searchLabel="Filtrar arquivos" pageSize={5} emptyMessage={trash ? "A lixeira está vazia." : "Nenhum arquivo neste local."} />{!view.visibleFiles.length && (folderId || trash) && <Link className="drive-trash-link" href="/drive">Voltar ao Meu Drive</Link>}</Card>
    <Drawer open={!!selectedFile} onClose={() => setFileId(null)} title={selectedFile?.name ?? "Arquivo"} description="Metadados de um arquivo de exemplo">
      {selectedFile && <dl className="drive-detail"><div><dt>Tipo</dt><dd>{selectedFile.mime}</dd></div><div><dt>Tamanho</dt><dd>{formatFileBytes(selectedFile.bytes)}</dd></div><div><dt>Local</dt><dd>{data.folders.find((folder) => folder.id === selectedFile.folder_id)?.name ?? "Meu Drive"}{selectedFile.deleted_at ? " · lixeira" : ""}</dd></div><div><dt>Modificado</dt><dd>{dateText(selectedFile.modified_at)}</dd></div></dl>}
    </Drawer>
  </div>;
}
