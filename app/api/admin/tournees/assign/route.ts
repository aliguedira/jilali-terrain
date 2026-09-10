import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// L'accès à ce point d'API est déjà filtré par proxy.ts.
export const dynamic = "force-dynamic";

/**
 * Assigne plusieurs tournées d'un coup à un militant (cases à cocher +
 * menu déroulant côté /admin/tournees).
 */
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

  const tourneeIds = payload.tourneeIds;
  if (!Array.isArray(tourneeIds) || tourneeIds.length === 0 || !tourneeIds.every((v) => typeof v === "string")) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const militantId = payload.militantId;
  if (typeof militantId !== "string" || !militantId) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  // Vérifie que le militant existe et est actif : pas la peine
  // d'assigner des tournées à un jeton révoqué.
  const { data: militant, error: militantError } = await supabase
    .from("comptes_terrain")
    .select("id, actif")
    .eq("id", militantId)
    .single();

  if (militantError || !militant) {
    return NextResponse.json({ error: "militant_introuvable" }, { status: 400 });
  }
  if (!militant.actif) {
    return NextResponse.json({ error: "militant_revoque" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tournees")
    .update({ militant_id: militantId })
    .in("id", tourneeIds)
    .select("id");

  if (error) {
    console.error("Erreur Supabase (assignation de tournées)", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, assignees: data?.length ?? 0 });
}
