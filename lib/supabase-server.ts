import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Client Supabase utilisant la clé de service (accès complet à la base).
 *
 * IMPORTANT : ce fichier importe "server-only", ce qui fait volontairement
 * échouer la compilation si jamais un composant affiché dans le navigateur
 * essayait de l'importer. La clé de service ne doit jamais quitter le
 * serveur — c'est elle qui contourne les règles de sécurité (RLS) de la
 * base, donc elle équivaut à un accès administrateur complet.
 *
 * Le navigateur d'un militant ou de l'admin ne parle donc JAMAIS
 * directement à Supabase : tout passe par nos propres routes serveur,
 * qui utilisent ce client et vérifient elles-mêmes les autorisations
 * (mot de passe admin, ou jeton de militant) à chaque requête.
 */

let cachedClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseServerClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Variables d'environnement Supabase manquantes : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies (voir le README).",
    );
  }

  cachedClient = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}
