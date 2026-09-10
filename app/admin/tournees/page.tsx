import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import TourneesAssigner, { type TourneeRow, type MilitantOption } from "@/components/admin/TourneesAssigner";

// Protégée par mot de passe (voir proxy.ts) ; toujours à jour.
export const dynamic = "force-dynamic";

export default async function AdminTourneesPage() {
  const supabase = getSupabaseServerClient();

  const [{ data: tournees, error: tourneesError }, { data: militants, error: militantsError }] = await Promise.all([
    supabase
      .from("tournees")
      .select(
        "id, numero_tournee, rue_principale, nombre_portes, militant_id, bureaux(numero_bureau, centre_vote), comptes_terrain(prenom)",
      )
      .order("numero_tournee", { ascending: true }),
    supabase.from("comptes_terrain").select("id, prenom").eq("actif", true).order("prenom", { ascending: true }),
  ]);

  const error = tourneesError ?? militantsError;

  const lignes: TourneeRow[] = (tournees ?? []).map((t) => {
    const bureau = Array.isArray(t.bureaux) ? t.bureaux[0] : t.bureaux;
    const militant = Array.isArray(t.comptes_terrain) ? t.comptes_terrain[0] : t.comptes_terrain;
    return {
      id: t.id,
      numero_tournee: t.numero_tournee,
      rue_principale: t.rue_principale,
      nombre_portes: t.nombre_portes,
      militant_id: t.militant_id,
      bureau_numero: bureau?.numero_bureau ?? "?",
      bureau_centre: bureau?.centre_vote ?? "?",
      militant_prenom: militant?.prenom ?? null,
    };
  });

  // Tri : par bureau puis par numéro de tournée, pour un affichage stable.
  lignes.sort((a, b) => {
    const bureauCompare = `${a.bureau_centre}${a.bureau_numero}`.localeCompare(`${b.bureau_centre}${b.bureau_numero}`, "ar", {
      numeric: true,
    });
    if (bureauCompare !== 0) return bureauCompare;
    return a.numero_tournee - b.numero_tournee;
  });

  const militantsOptions: MilitantOption[] = militants ?? [];

  return (
    <main className="min-h-screen bg-brand-paper p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-brand-ink">Assigner les tournées</h1>
          <Link href="/admin" className="rounded-lg border border-brand-navy px-4 py-2 text-sm font-semibold text-brand-navy">
            ← Militants
          </Link>
        </div>

        {error ? (
          <p className="text-sm text-red-600">Erreur lors de la lecture des données : {error.message}</p>
        ) : (
          <TourneesAssigner initialTournees={lignes} militants={militantsOptions} />
        )}
      </div>
    </main>
  );
}
