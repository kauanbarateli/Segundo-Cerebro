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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      domain_events: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          canal: string
          entity_id: string
          entity_type: string
          id: string
          occurred_at: string
          user_id: string
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          canal: string
          entity_id: string
          entity_type: string
          id?: string
          occurred_at?: string
          user_id: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          canal?: string
          entity_id?: string
          entity_type?: string
          id?: string
          occurred_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          locale: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          locale?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          locale?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          allowed: boolean
          feature_key: string
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          allowed: boolean
          feature_key: string
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          allowed?: boolean
          feature_key?: string
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_moderation: {
        Row: {
          changed_at: string
          changed_by: string | null
          must_change_password: boolean
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          must_change_password?: boolean
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          must_change_password?: boolean
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_modules: {
        Row: {
          created_at: string
          module_key: string
          sort_order: number
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          module_key: string
          sort_order?: number
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          module_key?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          default_calendar_view: string
          theme: string
          updated_at: string
          user_id: string
          values_hidden: boolean
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          default_calendar_view?: string
          theme?: string
          updated_at?: string
          user_id: string
          values_hidden?: boolean
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          default_calendar_view?: string
          theme?: string
          updated_at?: string
          user_id?: string
          values_hidden?: boolean
          week_starts_on?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_master: { Args: { p_user: string }; Returns: undefined }
      complete_password_change: {
        Args: { p_client_id: string; p_session: string; p_user: string }
        Returns: Json
      }
      consume_rate_limit: {
        Args: {
          p_scope: string
          p_session?: string
          p_subject_hash: string
          p_user?: string
        }
        Returns: Json
      }
      my_access_state: { Args: never; Returns: Json }
      prune_operational_data: { Args: never; Returns: Json }
      update_identity: {
        Args: {
          p_canal?: string
          p_client_id: string
          p_patch: Json
          p_resource: string
        }
        Returns: Json
      }
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
