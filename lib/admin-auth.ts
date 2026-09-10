/**
 * Protection très simple par mot de passe pour /admin.
 *
 * Le navigateur affiche sa propre fenêtre de connexion (pas besoin de
 * construire un formulaire) : il suffit de coller le mot de passe défini
 * dans la variable d'environnement ADMIN_PASSWORD (le nom d'utilisateur
 * demandé par cette fenêtre peut rester vide, seul le mot de passe compte).
 */

function extractPassword(authorizationHeader: string | null): string | null {
  if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) {
    return null;
  }
  try {
    const decoded = Buffer.from(
      authorizationHeader.slice("Basic ".length),
      "base64",
    ).toString("utf-8");
    const separatorIndex = decoded.indexOf(":");
    return separatorIndex === -1 ? decoded : decoded.slice(separatorIndex + 1);
  } catch {
    return null;
  }
}

export function isAdminAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  // Si la variable n'est pas configurée, on refuse tout accès plutôt que
  // de laisser la porte ouverte par erreur.
  if (!expected) return false;

  const provided = extractPassword(request.headers.get("authorization"));
  return provided !== null && provided === expected;
}

export function unauthorizedResponse(): Response {
  return new Response("Authentification requise.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Terrain", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
