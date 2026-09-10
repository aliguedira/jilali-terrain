/**
 * Numéros de téléphone mobiles marocains : normalisation et validation.
 *
 * Accepte, avec ou sans espaces / tirets / points :
 *   06XXXXXXXX   07XXXXXXXX
 *   6XXXXXXXX    7XXXXXXXX
 *   +2126XXXXXXXX   +2127XXXXXXXX
 *   002126XXXXXXXX  002127XXXXXXXX
 *
 * Retourne toujours, si valide, le format unique +212XXXXXXXXX (12
 * caractères après le +, 9 chiffres). C'est ce format qui est stocké en
 * base, pour qu'un même numéro ne puisse jamais créer deux fiches.
 *
 * IMPORTANT : ce fichier est une copie EXACTE, volontairement non
 * modifiée, de lib/phone.ts du projet jilali-public. Les numéros
 * collectés ici doivent être fusionnés le 22 septembre avec ceux du
 * site public pour un envoi SMS unique — la normalisation doit donc
 * produire rigoureusement les mêmes sorties dans les deux projets. Ne
 * jamais faire diverger ce fichier entre les deux dépôts.
 */
export function normalizeMoroccanPhone(raw: string): string | null {
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  let rest: string;

  if (digits.startsWith("00212")) {
    rest = digits.slice(5);
  } else if (digits.startsWith("212") && digits.length === 12) {
    rest = digits.slice(3);
  } else if (digits.startsWith("0")) {
    rest = digits.slice(1);
  } else {
    rest = digits;
  }

  // Un mobile marocain : 9 chiffres commençant par 6 ou 7.
  if (!/^[67]\d{8}$/.test(rest)) return null;

  return `+212${rest}`;
}

export function isValidMoroccanPhone(raw: string): boolean {
  return normalizeMoroccanPhone(raw) !== null;
}

/**
 * Masque un numéro pour l'affichage ou les journaux techniques (ex.
 * "+212******78"). Ne jamais écrire un numéro en clair dans les logs.
 */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `${phone.slice(0, 4)}${"*".repeat(phone.length - 6)}${phone.slice(-2)}`;
}
