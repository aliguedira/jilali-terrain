import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, unauthorizedResponse } from "./lib/admin-auth";

/**
 * S'exécute avant chaque page.
 *
 * - /admin (et son API) : protégé par le mot de passe ADMIN_PASSWORD,
 *   vérifié ici avant même que la page ne s'affiche.
 * - /t/[jeton] : pas de vérification ici. Le jeton EST le mot de passe ;
 *   la page elle-même le vérifie en base (voir app/t/[jeton]/page.tsx),
 *   et chaque route d'API qu'elle appelle le revérifie aussi, pour ne
 *   jamais dépendre uniquement de l'affichage côté client.
 * - Tout le reste (dont "/") : aucune page publique, voir app/page.tsx.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/")) {
    if (!isAdminAuthorized(request)) {
      return unauthorizedResponse();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
