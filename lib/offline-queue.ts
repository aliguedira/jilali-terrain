"use client";

/**
 * File d'attente hors-ligne, stockée dans le navigateur (localStorage).
 *
 * Principe : chaque saisie sur le terrain est d'abord écrite ici, tout
 * de suite, avant même d'essayer de l'envoyer au serveur. Elle reste
 * dans cette file jusqu'à confirmation d'enregistrement côté serveur.
 * Si le réseau saute, l'app ferme, ou le téléphone se verrouille, rien
 * n'est perdu : au retour, la file est toujours là et l'envoi reprend.
 *
 * localStorage (et non IndexedDB) a été choisi pour la simplicité et
 * la fiabilité : le volume de données par militant reste faible
 * (quelques tournées de 30 portes), largement dans la capacité de
 * localStorage (plusieurs Mo).
 */

export type Statut = "contacte" | "absent" | "porte_fermee" | "refus" | "carte_remise";

export interface SaisieEnAttente {
  clientId: string;
  porteId: string;
  tourneeId: string;
  statut: Statut;
  telephone: string | null;
  consentement: boolean;
  observation: string | null;
  creeLe: string;
}

function cleFile(jeton: string): string {
  return `terrain:${jeton}:file`;
}

function clePortes(tourneeId: string): string {
  return `terrain:tournee:${tourneeId}:portes`;
}

function lireJSON<T>(cle: string, defaut: T): T {
  if (typeof window === "undefined") return defaut;
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return defaut;
    return JSON.parse(brut) as T;
  } catch {
    return defaut;
  }
}

function ecrireJSON(cle: string, valeur: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Presse-papier/stockage plein ou indisponible : on ne bloque pas
    // la saisie en cours, seule la persistance hors-ligne est perdue.
  }
}

export function genererClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function chargerFile(jeton: string): SaisieEnAttente[] {
  return lireJSON<SaisieEnAttente[]>(cleFile(jeton), []);
}

/**
 * Ajoute une saisie à la file, en remplaçant une éventuelle saisie pas
 * encore synchronisée pour la même porte : seul l'état final compte,
 * pas la peine de renvoyer chaque étape intermédiaire une fois le
 * réseau revenu (important avec un réseau mobile faible).
 */
export function ajouterALaFile(jeton: string, saisie: SaisieEnAttente): void {
  const file = chargerFile(jeton).filter((s) => s.porteId !== saisie.porteId);
  file.push(saisie);
  ecrireJSON(cleFile(jeton), file);
}

export function retirerDeLaFile(jeton: string, clientId: string): void {
  const file = chargerFile(jeton).filter((s) => s.clientId !== clientId);
  ecrireJSON(cleFile(jeton), file);
}

/** Cache local des portes d'une tournée (pour consultation hors-ligne). */
export function chargerPortesCache<T>(tourneeId: string): T[] | null {
  return lireJSON<T[] | null>(clePortes(tourneeId), null);
}

export function sauvegarderPortesCache<T>(tourneeId: string, portes: T[]): void {
  ecrireJSON(clePortes(tourneeId), portes);
}
