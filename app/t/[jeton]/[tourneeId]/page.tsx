import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getMilitantParJeton } from "@/lib/militant-auth";
import TourneeClient, { type PorteData } from "@/components/militant/TourneeClient";

export const dynamic = "force-dynamic";

export default async function TourneePage({
  params,
}: {
  params: Promise<{ jeton: string; tourneeId: string }>;
}) {
  const { jeton, tourneeId } = await params;
  const militant = await getMilitantParJeton(jeton);
  if (!militant) notFound();

  const supabase = getSupabaseServerClient();

  // Vérifie que cette tournée est bien assignée à CE militant, avant
  // même de charger la moindre porte — jamais seulement via le lien.
  const { data: tournee } = await supabase
    .from("tournees")
    .select("id, militant_id, bureaux(numero_bureau)")
    .eq("id", tourneeId)
    .maybeSingle();

  if (!tournee || tournee.militant_id !== militant.id) notFound();

  const { data: portes } = await supabase
    .from("portes")
    .select(
      "id, adresse_brute, rue, numero_voie, nom, prenom, tranche_age, immeuble, ordre, statut, telephone, consentement, observation",
    )
    .eq("tournee_id", tourneeId)
    .order("ordre", { ascending: true });

  const bureau = Array.isArray(tournee.bureaux) ? tournee.bureaux[0] : tournee.bureaux;

  return (
    <main className="min-h-screen bg-brand-paper p-3">
      <div className="mx-auto max-w-md">
        <Link href={`/t/${jeton}`} className="mb-2 inline-block text-sm font-semibold text-brand-navy">
          ← Mes tournées
        </Link>
        <TourneeClient
          jeton={jeton}
          tourneeId={tourneeId}
          bureauNumero={bureau?.numero_bureau ?? "?"}
          initialPortes={(portes ?? []) as PorteData[]}
        />
      </div>
    </main>
  );
}
