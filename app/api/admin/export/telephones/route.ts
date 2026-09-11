import { getSupabaseServerClient } from "@/lib/supabase-server";
import { toCsv } from "@/lib/csv";

// Protégée par proxy.ts (mot de passe admin), comme le reste de /api/admin.
export const dynamic = "force-dynamic";

const COLONNES = ["prenom", "telephone", "tranche_age", "bureau_numero", "consentement_le"];

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("portes")
    .select("prenom, telephone, tranche_age, consentement_le, bureaux(numero_bureau)")
    .not("telephone", "is", null)
    .order("consentement_le", { ascending: true });

  if (error) {
    console.error("Erreur Supabase (export téléphones)", error.message);
    return new Response("Erreur lors de la lecture des données.", { status: 500 });
  }

  const lignes = (data ?? []).map((p) => {
    const bureau = Array.isArray(p.bureaux) ? p.bureaux[0] : p.bureaux;
    return {
      prenom: p.prenom,
      telephone: p.telephone,
      tranche_age: p.tranche_age,
      bureau_numero: bureau?.numero_bureau ?? "",
      consentement_le: p.consentement_le,
    };
  });

  const csv = toCsv(lignes, COLONNES);
  const corps = "﻿" + csv;
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return new Response(corps, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="telephones-${aujourdhui}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
