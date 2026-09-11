import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import MilitantsManager, { type Militant } from "@/components/admin/MilitantsManager";

// Protégée par mot de passe (voir proxy.ts) ; toujours à jour.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = getSupabaseServerClient();

  const [{ data: militants, error: militantsError }, { data: tournees, error: tourneesError }] = await Promise.all([
    supabase
      .from("comptes_terrain")
      .select("id, prenom, jeton, actif, cree_le, revoque_le")
      .order("cree_le", { ascending: false }),
    supabase.from("tournees").select("militant_id"),
  ]);

  const error = militantsError ?? tourneesError;

  const comptesParMilitant = new Map<string, number>();
  for (const t of tournees ?? []) {
    if (t.militant_id) comptesParMilitant.set(t.militant_id, (comptesParMilitant.get(t.militant_id) ?? 0) + 1);
  }

  const militantsAvecTournees: Militant[] = (militants ?? []).map((m) => ({
    ...m,
    nombre_tournees: comptesParMilitant.get(m.id) ?? 0,
  }));

  return (
    <main className="min-h-screen bg-brand-paper p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-brand-ink">Militants</h1>
          <nav className="flex gap-2">
            <Link href="/admin/tableau-de-bord" className="rounded-lg border border-brand-navy px-3 py-1.5 text-sm font-semibold text-brand-navy">
              Tableau de bord
            </Link>
            <Link href="/admin/tournees" className="rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-semibold text-white">
              Assigner les tournées →
            </Link>
          </nav>
        </div>

        {error ? (
          <p className="text-sm text-red-600">Erreur lors de la lecture des données : {error.message}</p>
        ) : (
          <MilitantsManager initialMilitants={militantsAvecTournees} />
        )}
      </div>
    </main>
  );
}
