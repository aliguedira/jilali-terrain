import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getMilitantParJeton } from "@/lib/militant-auth";

export const dynamic = "force-dynamic";

export default async function AccueilMilitantPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const militant = await getMilitantParJeton(jeton);
  if (!militant) notFound();

  const supabase = getSupabaseServerClient();
  const { data: tournees } = await supabase
    .from("tournees")
    .select("id, numero_tournee, rue_principale, nombre_portes, bureaux(numero_bureau), portes(statut)")
    .eq("militant_id", militant.id)
    .order("numero_tournee", { ascending: true });

  const lignes = (tournees ?? []).map((t) => {
    const bureau = Array.isArray(t.bureaux) ? t.bureaux[0] : t.bureaux;
    const portes = t.portes ?? [];
    const faites = portes.filter((p) => p.statut !== null).length;
    return {
      id: t.id,
      numeroBureau: bureau?.numero_bureau ?? "?",
      ruePrincipale: t.rue_principale,
      nombrePortes: t.nombre_portes,
      faites,
    };
  });

  return (
    <main className="min-h-screen bg-brand-paper p-4">
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-xl font-bold text-brand-ink">Bonjour {militant.prenom}</h1>
        <p className="mb-5 text-sm text-brand-ink/70">
          {lignes.length === 0 ? "Aucune tournée ne vous est encore assignée." : "Vos tournées :"}
        </p>

        <div className="flex flex-col gap-3">
          {lignes.map((t) => (
            <Link
              key={t.id}
              href={`/t/${jeton}/${t.id}`}
              className="block rounded-xl border border-brand-line bg-white p-4 shadow-sm active:bg-brand-paper"
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-brand-ink">Bureau {t.numeroBureau}</span>
                <span className="rounded-full bg-brand-navy px-3 py-1 text-sm font-bold text-white">
                  {t.faites} / {t.nombrePortes}
                </span>
              </div>
              {t.ruePrincipale && <p className="mt-1 text-sm text-brand-ink/70">{t.ruePrincipale}</p>}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
