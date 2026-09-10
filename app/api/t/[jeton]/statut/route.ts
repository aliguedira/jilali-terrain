import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getMilitantParJeton } from "@/lib/militant-auth";
import { normalizeMoroccanPhone, maskPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const STATUTS_VALIDES = ["contacte", "absent", "porte_fermee", "refus", "carte_remise"] as const;

/**
 * Enregistre la saisie d'un militant sur une porte. Vérifie à CHAQUE
 * appel que le jeton est valide et que la porte appartient bien à une
 * tournée assignée à ce militant — jamais seulement côté affichage.
 *
 * Idempotent via clientId : si cette saisie exacte (même clientId) a
 * déjà été enregistrée, on répond succès sans la réappliquer — utile
 * quand la connexion coupe juste après l'envoi et que le militant (ou
 * la file d'attente automatique) réessaie.
 */
export async function POST(request: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const militant = await getMilitantParJeton(jeton);
  if (!militant) {
    return NextResponse.json({ error: "jeton_invalide" }, { status: 401 });
  }

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

  const porteId = typeof payload.porteId === "string" ? payload.porteId : "";
  const clientId = typeof payload.clientId === "string" ? payload.clientId : "";
  const statut = typeof payload.statut === "string" ? payload.statut : "";
  if (!porteId || !clientId || !(STATUTS_VALIDES as readonly string[]).includes(statut)) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const consentement = payload.consentement === true;
  let telephone: string | null = null;
  if (typeof payload.telephone === "string" && payload.telephone.trim()) {
    if (!consentement) {
      return NextResponse.json({ error: "consentement_requis_pour_telephone" }, { status: 400 });
    }
    telephone = normalizeMoroccanPhone(payload.telephone);
    if (!telephone) {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }
  }

  const observation =
    typeof payload.observation === "string" && payload.observation.trim() ? payload.observation.trim().slice(0, 500) : null;

  const supabase = getSupabaseServerClient();

  // Vérifie que la porte appartient bien à une tournée assignée à CE
  // militant — c'est le contrôle de sécurité central de cette route.
  const { data: porte, error: porteError } = await supabase
    .from("portes")
    .select("id, dernier_client_id, tournees!inner(militant_id)")
    .eq("id", porteId)
    .single();

  if (porteError || !porte) {
    return NextResponse.json({ error: "porte_introuvable" }, { status: 404 });
  }
  const tournee = Array.isArray(porte.tournees) ? porte.tournees[0] : porte.tournees;
  if (tournee?.militant_id !== militant.id) {
    return NextResponse.json({ error: "acces_refuse" }, { status: 403 });
  }

  // Saisie déjà enregistrée (retransmission après coupure réseau) :
  // on ne la réapplique pas, on confirme juste le succès.
  if (porte.dernier_client_id === clientId) {
    return NextResponse.json({ ok: true, deja_enregistre: true });
  }

  const { error: updateError } = await supabase
    .from("portes")
    .update({
      statut,
      telephone,
      consentement,
      consentement_le: telephone && consentement ? new Date().toISOString() : null,
      observation,
      dernier_client_id: clientId,
      mis_a_jour_le: new Date().toISOString(),
      mis_a_jour_par: militant.id,
    })
    .eq("id", porteId);

  if (updateError) {
    console.error("Erreur Supabase (saisie terrain)", {
      porteId,
      phone: telephone ? maskPhone(telephone) : undefined,
      message: updateError.message,
    });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
