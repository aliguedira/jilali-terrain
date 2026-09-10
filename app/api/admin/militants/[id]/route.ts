import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// L'accès à ce point d'API est déjà filtré par proxy.ts.
export const dynamic = "force-dynamic";

/**
 * Révoque un militant (coupe l'accès à son lien personnel). Le lien
 * /t/[jeton] devra vérifier "actif = true" avant d'afficher quoi que
 * ce soit — voir Étape 3.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  if (payload.action !== "revoquer") {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("comptes_terrain")
    .update({ actif: false, revoque_le: new Date().toISOString() })
    .eq("id", id)
    .select("id, prenom, actif, revoque_le")
    .single();

  if (error) {
    console.error("Erreur Supabase (révocation militant)", { militantId: id, message: error.message });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, militant: data });
}
