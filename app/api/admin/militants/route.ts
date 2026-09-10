import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { generateToken } from "@/lib/import-utils";

// L'accès à ce point d'API est déjà filtré par proxy.ts (mot de passe
// admin), comme /admin et /admin/tournees.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  const prenom = typeof payload.prenom === "string" ? payload.prenom.trim() : "";
  if (!prenom) {
    return NextResponse.json({ error: "prenom_requis" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  // Un jeton est une chaîne aléatoire longue : en cas (extrêmement
  // improbable) de collision, on réessaie une fois avec un nouveau.
  for (let tentative = 0; tentative < 3; tentative++) {
    const jeton = generateToken();
    const { data, error } = await supabase
      .from("comptes_terrain")
      .insert({ prenom, jeton })
      .select("id, prenom, jeton, actif, cree_le, revoque_le")
      .single();

    if (!error) {
      return NextResponse.json({ ok: true, militant: data });
    }
    if (error.code !== "23505") {
      console.error("Erreur Supabase (création militant)", error.message);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    // 23505 = jeton déjà utilisé (collision) : on boucle et on réessaie.
  }

  return NextResponse.json({ error: "server_error" }, { status: 500 });
}
