export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bureaux: {
        Row: {
          arrondissement: string | null
          centre_vote: string
          cree_le: string
          id: string
          nombre_inscrits: number | null
          numero_bureau: string
        }
        Insert: {
          arrondissement?: string | null
          centre_vote: string
          cree_le?: string
          id?: string
          nombre_inscrits?: number | null
          numero_bureau: string
        }
        Update: {
          arrondissement?: string | null
          centre_vote?: string
          cree_le?: string
          id?: string
          nombre_inscrits?: number | null
          numero_bureau?: string
        }
        Relationships: []
      }
      comptes_terrain: {
        Row: {
          actif: boolean
          cree_le: string
          id: string
          jeton: string
          prenom: string
          revoque_le: string | null
        }
        Insert: {
          actif?: boolean
          cree_le?: string
          id?: string
          jeton: string
          prenom: string
          revoque_le?: string | null
        }
        Update: {
          actif?: boolean
          cree_le?: string
          id?: string
          jeton?: string
          prenom?: string
          revoque_le?: string | null
        }
        Relationships: []
      }
      portes: {
        Row: {
          adresse_brute: string
          bureau_id: string
          consentement: boolean
          consentement_le: string | null
          cree_le: string
          dernier_client_id: string | null
          id: string
          immeuble: boolean
          mis_a_jour_le: string | null
          mis_a_jour_par: string | null
          nom: string
          numero_voie: string | null
          observation: string | null
          ordre: number
          prenom: string
          rue: string
          statut: string | null
          telephone: string | null
          tournee_id: string
          tranche_age: string
        }
        Insert: {
          adresse_brute: string
          bureau_id: string
          consentement?: boolean
          consentement_le?: string | null
          cree_le?: string
          dernier_client_id?: string | null
          id?: string
          immeuble?: boolean
          mis_a_jour_le?: string | null
          mis_a_jour_par?: string | null
          nom: string
          numero_voie?: string | null
          observation?: string | null
          ordre: number
          prenom: string
          rue: string
          statut?: string | null
          telephone?: string | null
          tournee_id: string
          tranche_age: string
        }
        Update: {
          adresse_brute?: string
          bureau_id?: string
          consentement?: boolean
          consentement_le?: string | null
          cree_le?: string
          dernier_client_id?: string | null
          id?: string
          immeuble?: boolean
          mis_a_jour_le?: string | null
          mis_a_jour_par?: string | null
          nom?: string
          numero_voie?: string | null
          observation?: string | null
          ordre?: number
          prenom?: string
          rue?: string
          statut?: string | null
          telephone?: string | null
          tournee_id?: string
          tranche_age?: string
        }
        Relationships: [
          {
            foreignKeyName: "portes_bureau_id_fkey"
            columns: ["bureau_id"]
            isOneToOne: false
            referencedRelation: "bureaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portes_mis_a_jour_par_fkey"
            columns: ["mis_a_jour_par"]
            isOneToOne: false
            referencedRelation: "comptes_terrain"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portes_tournee_id_fkey"
            columns: ["tournee_id"]
            isOneToOne: false
            referencedRelation: "tournees"
            referencedColumns: ["id"]
          },
        ]
      }
      tournees: {
        Row: {
          bureau_id: string
          cree_le: string
          id: string
          militant_id: string | null
          nombre_portes: number
          numero_tournee: number
          rue_principale: string | null
        }
        Insert: {
          bureau_id: string
          cree_le?: string
          id?: string
          militant_id?: string | null
          nombre_portes?: number
          numero_tournee: number
          rue_principale?: string | null
        }
        Update: {
          bureau_id?: string
          cree_le?: string
          id?: string
          militant_id?: string | null
          nombre_portes?: number
          numero_tournee?: number
          rue_principale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournees_bureau_id_fkey"
            columns: ["bureau_id"]
            isOneToOne: false
            referencedRelation: "bureaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournees_militant_id_fkey"
            columns: ["militant_id"]
            isOneToOne: false
            referencedRelation: "comptes_terrain"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
