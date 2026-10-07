/** Plain-text prototype references; no HTML, aliases or persistent page graph. */
export function normalizarTituloCaptura(title: string): string {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
export function reescreverReferenciaWiki(content: string, previousTitle: string, nextTitle: string, unlink = false): string {
  return content.replace(/\[\[([^\]\n]+)\]\]/g, (token: string, title: string) =>
    normalizarTituloCaptura(title) === normalizarTituloCaptura(previousTitle) ? unlink ? nextTitle : `[[${nextTitle}]]` : token);
}
