import "server-only";
import { getSupabaseServerClient } from "./supabase-server";

/**
 * Vérifie un jeton de militant et retourne son compte s'il est actif.
 * Utilisé par CHAQUE page et CHAQUE route d'API sous /t/[jeton] — le
 * jeton est le seul mécanisme d'authentification, donc cette
 * vérification doit se faire ici, côté serveur, à chaque requête. Ne
 * jamais faire confiance à l'affichage côté client pour ça.
 */
export async function getMilitantParJeton(jeton: string) {
  if (!jeton) return null;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("comptes_terrain")
    .select("id, prenom, actif")
    .eq("jeton", jeton)
    .eq("actif", true)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
