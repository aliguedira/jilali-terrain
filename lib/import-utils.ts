import { randomBytes } from "node:crypto";

/**
 * Fonctions utilitaires pour le script d'import (scripts/import.ts) et
 * pour la génération de jetons militants. Séparées dans lib/ pour
 * pouvoir être testées facilement.
 */

// Diacritiques arabes (tashkeel) à retirer : fatha, damma, kasra, sukun,
// chadda, tanwin, etc.
const ARABIC_DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
// Tatouil (trait d'allongement ـ), sans valeur pour le tri.
const TATWEEL = /ـ/g;
// Ponctuation courante (arabe et latine) à remplacer par un espace.
const PUNCTUATION = /[.,:;!?"'«»()[\]{}\-_/\\]/g;

/**
 * Normalise une adresse arabe pour le tri : retire les diacritiques,
 * unifie les variantes d'alif (أ إ آ ٱ → ا) et de ya (ى → ي), retire la
 * ponctuation, et réduit les espaces multiples.
 */
export function normalizeArabicAddress(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.normalize("NFKC");
  s = s.replace(ARABIC_DIACRITICS, "");
  s = s.replace(TATWEEL, "");
  s = s.replace(/[أإآٱ]/g, "ا");
  s = s.replace(/ى/g, "ي");
  s = s.replace(PUNCTUATION, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

const IMMEUBLE_KEYWORDS = ["عمارة", "شقة", "إقامة", "بلوك", "طابق"];

/**
 * Sépare une adresse normalisée en nom de voie (sans les chiffres) et
 * numéro (le premier nombre trouvé). Retire aussi les mots indiquant un
 * immeuble ("عمارة"...) : sans ça, "عمارة شارع X" et "شارع X" seraient
 * traités comme deux rues différentes et ne se regrouperaient pas au
 * tri, alors qu'elles désignent la même rue.
 *
 * Heuristique simple à ajuster une fois le vrai fichier reçu : elle
 * suppose qu'un numéro de rue apparaît quelque part dans l'adresse,
 * précédé ou non du mot "رقم" (numéro).
 */
export function splitStreetAndNumber(normalizedAddress: string): {
  rue: string;
  numeroVoie: string;
} {
  const numeroMatch = normalizedAddress.match(/\d+/);
  const numeroVoie = numeroMatch ? numeroMatch[0] : "";
  let rue = normalizedAddress.replace(/رقم/g, "").replace(/\d+/g, "");
  for (const kw of IMMEUBLE_KEYWORDS) {
    rue = rue.replace(new RegExp(kw, "g"), "");
  }
  rue = rue.replace(/\s+/g, " ").trim();
  return { rue, numeroVoie };
}

export type TrancheAge = "18-34" | "35-59" | "60+";

/**
 * Calcule la tranche d'âge à la date du scrutin. Ne retourne jamais la
 * date de naissance elle-même : c'est tout l'intérêt de cette fonction
 * (minimisation des données, la date exacte n'est jamais stockée).
 */
export function computeAgeBracket(
  birthDate: Date,
  referenceDate: Date,
): TrancheAge | null {
  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    referenceDate.getMonth() > birthDate.getMonth() ||
    (referenceDate.getMonth() === birthDate.getMonth() &&
      referenceDate.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;

  if (age < 18 || age > 130) return null; // valeur aberrante, à signaler
  if (age <= 34) return "18-34";
  if (age <= 59) return "35-59";
  return "60+";
}

/** Déduit si une adresse correspond à un immeuble (pur repère visuel). */
export function detectImmeuble(normalizedAddress: string): boolean {
  return IMMEUBLE_KEYWORDS.some((kw) => normalizedAddress.includes(kw));
}

/**
 * Génère un jeton de militant : 32 octets aléatoires en base64url (pas
 * de caractères ambigus dans une URL), impossible à deviner.
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}
