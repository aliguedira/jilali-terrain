import { getSupabaseServerClient } from "@/lib/supabase-server";
import { toCsv } from "@/lib/csv";

// Protégée par proxy.ts (mot de passe admin), comme le reste de /api/admin.
export const dynamic = "force-dynamic";

const COLONNES = [
  "bureau_numero",
  "tournee_numero",
  "rue",
  "numero_voie",
  "nom",
  "prenom",
  "tranche_age",
  "immeuble",
  "statut",
  "telephone",
  "consentement",
  "observation",
  "militant",
  "mis_a_jour_le",
];

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("portes")
    .select(
      "rue, numero_voie, nom, prenom, tranche_age, immeuble, statut, telephone, consentement, observation, mis_a_jour_le, bureaux(numero_bureau), tournees(numero_tournee, comptes_terrain(prenom))",
    )
    .order("mis_a_jour_le", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("Erreur Supabase (export statuts)", error.message);
    return new Response("Erreur lors de la lecture des données.", { status: 500 });
  }

  const lignes = (data ?? []).map((p) => {
    const bureau = Array.isArray(p.bureaux) ? p.bureaux[0] : p.bureaux;
    const tournee = Array.isArray(p.tournees) ? p.tournees[0] : p.tournees;
    const militant = tournee ? (Array.isArray(tournee.comptes_terrain) ? tournee.comptes_terrain[0] : tournee.comptes_terrain) : null;
    return {
      bureau_numero: bureau?.numero_bureau ?? "",
      tournee_numero: tournee?.numero_tournee ?? "",
      rue: p.rue,
      numero_voie: p.numero_voie,
      nom: p.nom,
      prenom: p.prenom,
      tranche_age: p.tranche_age,
      immeuble: p.immeuble ? "oui" : "non",
      statut: p.statut ?? "non_visite",
      telephone: p.telephone,
      consentement: p.consentement ? "oui" : "non",
      observation: p.observation,
      militant: militant?.prenom ?? "",
      mis_a_jour_le: p.mis_a_jour_le,
    };
  });

  const csv = toCsv(lignes, COLONNES);
  const corps = "﻿" + csv;
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return new Response(corps, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="statuts-${aujourdhui}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
