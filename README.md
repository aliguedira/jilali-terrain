# Application terrain — porte-à-porte

Ce document est écrit pour vous, sans supposer que vous savez programmer.
Gardez-le sous la main : c'est votre mode d'emploi de l'espace
administrateur (`/admin`).

**Rappel important** : cette application est complètement séparée du site
de campagne (`jilali-public`). Elle contient la liste électorale
nominative des bureaux couverts — ne mélangez jamais les mots de passe,
les clés ou les exports des deux projets.

---

## 1. Comment créer un militant et lui envoyer son lien

1. Allez sur **https://jilali-terrain.vercel.app/admin** (mot de passe :
   voir section 6).
2. Dans le champ en haut de la page « Militants », tapez son prénom et
   cliquez sur **Créer**. Une ligne apparaît avec un lien personnel et
   un bouton **Copier le lien**.
3. Cliquez sur **Copier le lien**, puis collez-le dans un message
   WhatsApp au militant (un bouton **Copier message WhatsApp** prépare
   directement un texte prêt à envoyer).
4. Le lien ressemble à `https://jilali-terrain.vercel.app/t/xxxxxxxx...`.
   Il n'y a **ni identifiant ni mot de passe** à retenir pour le
   militant : ce lien, à lui seul, lui donne accès à ses tournées. Ne le
   publiez donc jamais publiquement (pas de post public, pas de groupe
   WhatsApp ouvert) — envoyez-le en message privé, à la personne
   concernée uniquement.

## 2. Comment assigner des tournées à un militant

1. Allez sur **https://jilali-terrain.vercel.app/admin/tournees**.
2. Les tournées sont groupées par bureau de vote. Cochez une ou
   plusieurs tournées (case à cocher sur chaque ligne, ou **Tout
   cocher** pour un bureau entier).
3. En bas, choisissez le militant dans la liste déroulante, puis
   cliquez sur **Assigner**.
4. Le militant verra immédiatement ces tournées apparaître sur son
   écran (`/t/son-lien`), avec le nombre de portes et sa progression.

Une tournée ne peut être assignée qu'à un seul militant à la fois — la
réassigner à quelqu'un d'autre la retire automatiquement à la personne
précédente.

## 3. Suivre l'avancement (tableau de bord)

Allez sur **https://jilali-terrain.vercel.app/admin/tableau-de-bord**.

Vous y trouverez :
- le nombre de tournées entièrement réalisées **aujourd'hui**,
- le **taux de contact effectif** (portes où quelqu'un a été joint,
  qu'il ait accepté ou refusé, sur l'ensemble des portes visitées),
- le nombre total de **téléphones recueillis** depuis le début,
- le nombre de **militants actifs hier** (ayant fait au moins une
  saisie),
- et séparément, le **taux d'acceptation** et le **taux de refus**
  parmi les personnes effectivement contactées.

Cette page se met à jour à chaque fois que vous la rechargez — elle
n'a pas besoin d'être laissée ouverte en permanence.

## 4. Comment exporter les données

Depuis le tableau de bord, deux boutons :

- **Exporter les téléphones recueillis** : un fichier
  `telephones-AAAA-MM-JJ.csv` avec uniquement les numéros collectés
  (avec consentement) — prénom, téléphone, tranche d'âge, bureau, date
  du consentement. C'est ce fichier qui servira à fusionner avec les
  contacts du site de campagne avant l'envoi de SMS, le 22 septembre.
- **Exporter tous les statuts** : un fichier `statuts-AAAA-MM-JJ.csv`
  avec le détail complet, porte par porte (adresse, statut, militant en
  charge, etc.) — utile pour un suivi fin ou pour retrouver une adresse
  précise.

Les deux s'ouvrent directement dans Excel. **Faites un export
régulièrement** (au moins une fois par jour pendant la campagne
terrain) — c'est votre sauvegarde en cas de problème technique.

## 5. Révoquer un lien (jeton)

- **Un seul militant** : sur la page « Militants », bouton
  **Révoquer** en face de son nom. Son lien cesse immédiatement de
  fonctionner (l'application le lui signale poliment, sans donner de
  détail).
- **Tous les militants d'un coup** : bouton rouge **Révoquer tous les
  jetons** en haut de la page « Militants ». À utiliser **le soir du
  22 septembre**, une fois la collecte terminée, pour fermer l'accès
  définitivement. Cette action est irréversible (il faudrait recréer
  chaque militant).

## 6. Variables d'environnement à créer dans Vercel

Ce sont des réglages secrets que l'application utilise pour se
connecter à sa base de données et se protéger. Il faut les créer une
fois, dans Vercel.

**Comment faire, pas à pas :**
1. Allez sur https://vercel.com et ouvrez le projet **jilali-terrain**.
2. Cliquez sur l'onglet **Settings**, puis dans le menu de gauche sur
   **Environment Variables**.
3. Pour chaque ligne du tableau ci-dessous : cliquez sur **Add New**,
   collez le **nom** dans le champ « Key » et la **valeur** dans le
   champ « Value », laissez les trois cases (Production/Preview/
   Development) cochées, puis **Save**.

| Nom de la variable | Valeur | Où la trouver |
|---|---|---|
| `SUPABASE_URL` | l'adresse de votre projet | Sur https://supabase.com/dashboard, ouvrez le projet **jilali-terrain** (⚠️ pas "jilali-public" — les deux bases ne doivent jamais être mélangées), allez dans **Project Settings** (icône d'engrenage) → **Data API** (ou **API**). Copiez le champ **Project URL**. |
| `SUPABASE_SERVICE_ROLE_KEY` | une longue clé secrète | Même écran, section **Project API keys**. Cherchez la clé nommée **`service_role`** (⚠️ pas `anon` / `public`). Cliquez sur "Reveal" puis copiez-la. **Ne la partagez jamais, ne la collez nulle part d'autre — surtout pas dans le projet jilali-public.** |
| `ADMIN_PASSWORD` | `nQgTvqgnKGzoLWzeSO` | Généré pour vous — vous pouvez le garder tel quel ou le remplacer par un mot de passe de votre choix. C'est lui qui protège tout l'espace `/admin`. |

4. Une fois les variables ajoutées, il faut **redéployer** pour
   qu'elles soient prises en compte : onglet **Deployments**, ouvrez le
   dernier déploiement (le plus haut dans la liste), menu **⋯** puis
   **Redeploy**.

**Important — ce que je ne dois jamais recevoir :** ne me communiquez
jamais `SUPABASE_SERVICE_ROLE_KEY`, ni aucune clé du projet
`jilali-public`. Copiez-collez ces valeurs vous-même, directement dans
Vercel.

## 7. « L'application ne répond plus », que faire ?

1. **Vérifiez d'abord sur votre téléphone avec les données mobiles
   coupées puis rallumées**, ou depuis un autre appareil — souvent
   c'est juste une coupure de connexion locale. Pour un militant sur le
   terrain : ses saisies déjà faites sont **conservées sur son
   téléphone** et s'enverront automatiquement dès que le réseau
   revient — rien n'est perdu en attendant.
2. Allez sur https://vercel.com, projet **jilali-terrain**, onglet
   **Deployments**. Si la dernière ligne affiche une croix rouge
   (« Error » / « Failed »), une dernière modification a empêché la
   republication — **la version précédente reste en ligne**, rien
   n'est perdu.
3. Si vous voyez une page d'erreur en visitant l'application elle-même,
   le plus probable est une variable d'environnement manquante ou mal
   recopiée (section 6).
4. Dans tous les cas : **envoyez-moi une capture d'écran**, avec
   l'heure approximative, et je regarde.
5. Votre filet de sécurité : l'export régulier (section 4) garantit
   qu'aucune donnée n'est perdue même en cas de problème.

---

## Pour information — état actuel des données

- Seuls **3 bureaux de vote** sont actuellement chargés dans
  l'application (sur les 21 du périmètre visé), le temps de terminer
  l'import des 18 restants. Ce n'est pas un problème technique — il
  suffit de me renvoyer le fichier Excel pour que je complète l'import
  quand vous le souhaitez.
- Aucun champ de l'application ne permet d'enregistrer une opinion
  politique nominative (pas de « sympathisant », pas de note) — c'est
  volontaire et ne doit jamais être ajouté, la loi marocaine 09-08
  classant cette donnée comme sensible.
- Le lien de chaque militant (`/t/...`) n'est jamais indexé par les
  moteurs de recherche et n'apparaît nulle part publiquement dans
  l'application — seul le lien que vous envoyez vous-même donne accès.
