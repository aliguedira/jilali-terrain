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
 * Analyse une adresse normalisée pour en tirer un repère de tri fiable.
 *
 * Constat fait sur le vrai fichier (voir le compte-rendu) : la plupart
 * des adresses de ce périmètre ne sont PAS de la forme classique "nom
 * de rue + numéro" mais suivent un système à quartier/secteur/bloc,
 * typique du quartier Ryad à Rabat :
 *
 *   "قطاع 12 بلوك ك رقم 5 حي الرياض"
 *   (secteur 12, bloc ك, numéro 5, quartier Ryad)
 *
 * Certaines adresses ont malgré tout une vraie rue nommée (شارع/زنقة).
 * D'autres ne correspondent à aucun des deux formats.
 *
 * Cette fonction lit l'adresse mot par mot et reconnaît les étiquettes
 * connues (قطاع/ق, بلوك/بل, رقم, شارع/زنقة, حي/ح/الرياض/الرباط comme
 * "bruit" sans valeur de tri, عمارة/اقامة/تجزئة/فيلا/شقة/جزيرة comme
 * détail secondaire). Le "groupe" retourné sert à regrouper et trier
 * les portes d'une même tournée :
 *   - secteur + bloc trouvés  -> groupe = "قطاع <secteur> بلوك <bloc>"
 *   - sinon une rue trouvée   -> groupe = la rue elle-même
 *   - sinon secteur seul      -> groupe = "قطاع <secteur>"
 *   - sinon                   -> groupe = l'adresse normalisée entière
 *
 * Heuristique volontairement pragmatique (pas une garantie à 100% sur
 * un texte libre aussi varié) : l'objectif est un ordre de passage
 * raisonnable pour une tournée à pied, pas une extraction parfaite.
 */
// "قظاع" est une variante orthographique de "قطاع" (ظ/ط) observée dans
// le vrai fichier — on la reconnaît aussi.
const ETIQUETTE_SECTEUR = /^(قطاع|قظاع|ق)$/;
const ETIQUETTE_BLOC = /^(بلوك|بل)$/;
const ETIQUETTE_NUMERO = /^رقم$/;
const ETIQUETTE_RUE = /^(شارع|زنقة)$/;
const MOTS_BRUIT = /^(حي|ح|الرياض|الرباط)$/;
const ETIQUETTE_DETAIL = /^(عمارة|اقامة|إقامة|تجزئة|فيلا|شقة|جزيرة|طابق)$/;

export function parseAdresseVoie(normalizedAddress: string): {
  rue: string;
  numeroVoie: string;
} {
  const tokens = normalizedAddress.split(" ").filter(Boolean);
  const consumed = new Set<number>();
  let secteur = "";
  let bloc = "";
  let numero = "";
  let rueNommee = "";

  // 1) Secteur : "قطاع"/"ق" suivi d'un numéro.
  const idxSecteur = tokens.findIndex((t) => ETIQUETTE_SECTEUR.test(t));
  if (idxSecteur !== -1 && idxSecteur + 1 < tokens.length) {
    secteur = tokens[idxSecteur + 1];
    consumed.add(idxSecteur);
    consumed.add(idxSecteur + 1);

    // 2) Bloc : juste après le secteur, avec ou sans le mot "بلوك"/"بل"
    // (constat sur le vrai fichier : le mot est très souvent omis,
    // ex. "قطاع 12 ك 5" -> "ك" est le bloc sans étiquette devant).
    const p = idxSecteur + 2;
    if (p < tokens.length) {
      if (ETIQUETTE_BLOC.test(tokens[p]) && p + 1 < tokens.length) {
        bloc = tokens[p + 1];
        consumed.add(p);
        consumed.add(p + 1);
      } else if (
        !/^\d+$/.test(tokens[p]) &&
        !ETIQUETTE_NUMERO.test(tokens[p]) &&
        !ETIQUETTE_RUE.test(tokens[p]) &&
        !MOTS_BRUIT.test(tokens[p]) &&
        !ETIQUETTE_DETAIL.test(tokens[p])
      ) {
        bloc = tokens[p];
        consumed.add(p);
      }
    }
  }

  // 3) Numéro : le mot "رقم" suivi d'une valeur n'importe où dans
  // l'adresse, sinon le premier chiffre restant (non déjà utilisé
  // comme numéro de secteur).
  const idxRqm = tokens.findIndex((t, i) => ETIQUETTE_NUMERO.test(t) && !consumed.has(i));
  if (idxRqm !== -1 && idxRqm + 1 < tokens.length) {
    numero = tokens[idxRqm + 1];
    consumed.add(idxRqm);
    consumed.add(idxRqm + 1);
  } else {
    const idxNum = tokens.findIndex((t, i) => /^\d+$/.test(t) && !consumed.has(i));
    if (idxNum !== -1) {
      numero = tokens[idxNum];
      consumed.add(idxNum);
    }
  }

  // 4) Rue nommée ("شارع"/"زنقة" ...), utilisée seulement si aucun
  // secteur n'a été trouvé (les deux systèmes coexistent rarement).
  if (!secteur) {
    const idxRue = tokens.findIndex((t) => ETIQUETTE_RUE.test(t));
    if (idxRue !== -1) {
      const morceaux: string[] = [];
      let j = idxRue + 1;
      while (
        j < tokens.length &&
        !ETIQUETTE_NUMERO.test(tokens[j]) &&
        !MOTS_BRUIT.test(tokens[j]) &&
        !ETIQUETTE_DETAIL.test(tokens[j]) &&
        !/^\d+$/.test(tokens[j])
      ) {
        morceaux.push(tokens[j]);
        j++;
      }
      rueNommee = morceaux.join(" ");
    }
  }

  let rue: string;
  if (secteur && bloc) {
    rue = `قطاع ${secteur} بلوك ${bloc}`;
  } else if (rueNommee) {
    rue = rueNommee;
  } else if (secteur) {
    rue = `قطاع ${secteur}`;
  } else {
    rue = normalizedAddress;
  }

  return { rue, numeroVoie: numero };
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
