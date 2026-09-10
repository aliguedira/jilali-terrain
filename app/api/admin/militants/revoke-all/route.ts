import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// L'accès à ce point d'API est déjà filtré par proxy.ts.
export const dynamic = "force-dynamic";

/**
 * Coupe l'accès de TOUS les militants d'un coup — bouton à utiliser le
 * soir du 22 septembre (veille du scrutin).
 */
export async function POST() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("comptes_terrain")
    .update({ actif: false, revoque_le: new Date().toISOString() })
    .eq("actif", true)
    .select("id");

  if (error) {
    console.error("Erreur Supabase (révocation de tous les jetons)", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, revoques: data?.length ?? 0 });
}
