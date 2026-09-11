import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Date au format AAAA-MM-JJ, dans le fuseau horaire du Maroc (et non
// celui du serveur, qui peut être ailleurs dans le monde).
function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function dayKeyOffset(joursAvant: number): string {
  const d = new Date();
  d.setDate(d.getDate() - joursAvant);
  return dayKey(d.toISOString());
}

export default async function TableauDeBordPage() {
  const supabase = getSupabaseServerClient();

  const [{ data: portes, error: portesError }, { data: tournees, error: tourneesError }] = await Promise.all([
    supabase.from("portes").select("id, tournee_id, statut, telephone, mis_a_jour_le, mis_a_jour_par"),
    supabase.from("tournees").select("id, nombre_portes"),
  ]);

  const error = portesError ?? tourneesError;
  if (error) {
    return (
      <main className="min-h-screen bg-brand-paper p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-red-600">Erreur lors de la lecture des données : {error.message}</p>
        </div>
      </main>
    );
  }

  const lignes = portes ?? [];
  const aujourdhui = dayKeyOffset(0);
  const hier = dayKeyOffset(1);

  // 1) Tournées réalisées aujourd'hui : toutes leurs portes ont un
  // statut, et la dernière saisie de la tournée date d'aujourd'hui.
  const portesParTournee = new Map<string, typeof lignes>();
  for (const p of lignes) {
    if (!portesParTournee.has(p.tournee_id)) portesParTournee.set(p.tournee_id, []);
    portesParTournee.get(p.tournee_id)!.push(p);
  }
  let tourneesRealiseesAujourdhui = 0;
  for (const t of tournees ?? []) {
    const portesTournee = portesParTournee.get(t.id) ?? [];
    const toutesFaites = portesTournee.length === t.nombre_portes && portesTournee.every((p) => p.statut !== null);
    if (!toutesFaites) continue;
    const derniereMaj = portesTournee
      .map((p) => p.mis_a_jour_le)
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1);
    if (derniereMaj && dayKey(derniereMaj) === aujourdhui) tourneesRealiseesAujourdhui++;
  }

  // 2) Taux de contact effectif = (contacté + refus + carte remise) / (toutes les portes visitées).
  const visitees = lignes.filter((p) => p.statut !== null);
  const contactsEffectifs = visitees.filter((p) => p.statut === "contacte" || p.statut === "refus" || p.statut === "carte_remise");
  const tauxContactEffectif = visitees.length > 0 ? Math.round((contactsEffectifs.length / visitees.length) * 100) : 0;

  // Acceptation / refus, parmi les contacts effectifs uniquement.
  const acceptations = visitees.filter((p) => p.statut === "contacte" || p.statut === "carte_remise").length;
  const refus = visitees.filter((p) => p.statut === "refus").length;
  const tauxAcceptation = contactsEffectifs.length > 0 ? Math.round((acceptations / contactsEffectifs.length) * 100) : 0;
  const tauxRefus = contactsEffectifs.length > 0 ? Math.round((refus / contactsEffectifs.length) * 100) : 0;

  // 3) Téléphones recueillis (cumul).
  const telephonesRecueillis = lignes.filter((p) => p.telephone !== null).length;

  // 4) Militants actifs hier : au moins une saisie datée d'hier.
  const militantsActifsHier = new Set(
    lignes.filter((p) => p.mis_a_jour_par && p.mis_a_jour_le && dayKey(p.mis_a_jour_le) === hier).map((p) => p.mis_a_jour_par),
  ).size;

  return (
    <main className="min-h-screen bg-brand-paper p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-brand-ink">Tableau de bord</h1>
          <nav className="flex gap-2">
            <Link href="/admin" className="rounded-lg border border-brand-navy px-3 py-1.5 text-sm font-semibold text-brand-navy">
              Militants
            </Link>
            <Link href="/admin/tournees" className="rounded-lg border border-brand-navy px-3 py-1.5 text-sm font-semibold text-brand-navy">
              Tournées
            </Link>
          </nav>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Carte valeur={tourneesRealiseesAujourdhui} libelle="Tournées réalisées aujourd'hui" />
          <Carte valeur={`${tauxContactEffectif}%`} libelle="Taux de contact effectif" />
          <Carte valeur={telephonesRecueillis} libelle="Téléphones recueillis (cumul)" />
          <Carte valeur={militantsActifsHier} libelle="Militants actifs hier" />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
          <Carte petite valeur={`${tauxAcceptation}%`} libelle="Taux d'acceptation" />
          <Carte petite valeur={`${tauxRefus}%`} libelle="Taux de refus" />
        </div>

        <div className="rounded-lg border border-brand-line bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-brand-ink">Exports</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/api/admin/export/telephones" className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white">
              Exporter les téléphones recueillis
            </a>
            <a href="/api/admin/export/statuts" className="rounded-lg border border-brand-navy px-4 py-2 text-sm font-semibold text-brand-navy">
              Exporter tous les statuts
            </a>
          </div>
          <p className="mt-2 text-xs text-brand-ink/60">Fichiers .csv, s'ouvrent directement dans Excel.</p>
        </div>
      </div>
    </main>
  );
}

function Carte({ valeur, libelle, petite }: { valeur: string | number; libelle: string; petite?: boolean }) {
  return (
    <div className="rounded-lg border border-brand-line bg-white p-4">
      <div className={petite ? "text-xl font-bold text-brand-navy" : "text-2xl font-bold text-brand-navy"}>{valeur}</div>
      <div className="mt-1 text-xs text-brand-ink/70">{libelle}</div>
    </div>
  );
}
