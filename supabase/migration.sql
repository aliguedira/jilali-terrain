-- Schéma de la base "jilali-terrain".
--
-- Sécurité : Row Level Security est activée sur chaque table, sans
-- aucune règle (politique). Par défaut, Postgres refuse alors TOUT accès
-- à quiconque n'utilise pas la clé de service ("service_role"), y
-- compris un accès direct depuis un navigateur avec la clé publique.
-- Seul notre code serveur (qui utilise la clé de service et vérifie
-- lui-même le mot de passe admin ou le jeton du militant) peut lire ou
-- écrire dans ces tables.

-- Les bureaux de vote du périmètre importé (pas la liste électorale
-- complète : seulement les bureaux choisis à l'import).
create table if not exists bureaux (
  id uuid primary key default gen_random_uuid(),
  numero_bureau text not null,
  centre_vote text not null,
  arrondissement text,
  nombre_inscrits integer,
  cree_le timestamptz not null default now(),
  unique (centre_vote, numero_bureau)
);
alter table bureaux enable row level security;

-- Les comptes des militants : un jeton = un militant = un lien
-- personnel secret. Pas de mot de passe.
create table if not exists comptes_terrain (
  id uuid primary key default gen_random_uuid(),
  prenom text not null,
  jeton text not null unique,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  revoque_le timestamptz
);
alter table comptes_terrain enable row level security;

-- Les tournées : des parcours de porte-à-porte de 30 portes, découpés
-- automatiquement à l'import, assignés ensuite à un militant.
create table if not exists tournees (
  id uuid primary key default gen_random_uuid(),
  bureau_id uuid not null references bureaux(id) on delete restrict,
  numero_tournee integer not null,
  rue_principale text,
  nombre_portes integer not null default 0,
  militant_id uuid references comptes_terrain(id) on delete set null,
  cree_le timestamptz not null default now(),
  unique (bureau_id, numero_tournee)
);
alter table tournees enable row level security;
create index if not exists tournees_militant_id_idx on tournees(militant_id);
create index if not exists tournees_bureau_id_idx on tournees(bureau_id);

-- Les portes : une ligne par personne de la liste électorale importée
-- (plusieurs portes peuvent partager la même adresse). Le statut
-- affiché est toujours le dernier enregistré ; pas d'historique séparé
-- (choix de minimisation des données), seulement un identifiant
-- technique ("dernier_client_id") qui sert à éviter qu'une même saisie,
-- envoyée deux fois à cause d'une coupure réseau, soit comptée deux fois.
create table if not exists portes (
  id uuid primary key default gen_random_uuid(),
  tournee_id uuid not null references tournees(id) on delete restrict,
  bureau_id uuid not null references bureaux(id) on delete restrict,
  adresse_brute text not null,
  rue text not null,
  numero_voie text,
  nom text not null,
  prenom text not null,
  tranche_age text not null check (tranche_age in ('18-34', '35-59', '60+')),
  immeuble boolean not null default false,
  ordre integer not null,
  statut text check (statut in ('contacte', 'absent', 'porte_fermee', 'refus', 'carte_remise')),
  telephone text,
  consentement boolean not null default false,
  consentement_le timestamptz,
  observation text,
  dernier_client_id text,
  mis_a_jour_le timestamptz,
  mis_a_jour_par uuid references comptes_terrain(id) on delete set null,
  cree_le timestamptz not null default now()
);
alter table portes enable row level security;
create index if not exists portes_tournee_id_idx on portes(tournee_id);
create index if not exists portes_bureau_id_idx on portes(bureau_id);
create index if not exists portes_rue_numero_idx on portes(bureau_id, rue, numero_voie);
