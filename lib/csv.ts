/**
 * Génère un CSV compatible Excel (séparateur point-virgule, attendu
 * par la version française d'Excel). Le BOM UTF-8 ajouté par
 * l'appelant permet à Excel d'afficher correctement les accents.
 */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  function echapper(valeur: unknown): string {
    if (valeur === null || valeur === undefined) return "";
    const texte = String(valeur);
    if (/[;"\n]/.test(texte)) return `"${texte.replace(/"/g, '""')}"`;
    return texte;
  }

  const entete = columns.join(";");
  const lignes = rows.map((r) => columns.map((c) => echapper(r[c])).join(";"));
  return [entete, ...lignes].join("\n");
}
