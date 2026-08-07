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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_conversions: {
        Row: {
          activity_key: string
          created_at: string
          enabled: boolean
          id: string
          is_custom: boolean
          label: string
          pushups_per_unit: number
          unit: string
          unit_step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_key: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_custom?: boolean
          label: string
          pushups_per_unit?: number
          unit: string
          unit_step?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_key?: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_custom?: boolean
          label?: string
          pushups_per_unit?: number
          unit?: string
          unit_step?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          kind: string
          note: string | null
          reps: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date?: string
          id?: string
          kind: string
          note?: string | null
          reps: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          kind?: string
          note?: string | null
          reps?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pushup_logs: {
        Row: {
          activity_amount: number | null
          activity_key: string | null
          activity_label: string | null
          activity_unit: string | null
          created_at: string
          id: string
          log_date: string
          logged_at: string
          reps: number
          slot: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_amount?: number | null
          activity_key?: string | null
          activity_label?: string | null
          activity_unit?: string | null
          created_at?: string
          id?: string
          log_date?: string
          logged_at?: string
          reps: number
          slot?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_amount?: number | null
          activity_key?: string | null
          activity_label?: string | null
          activity_unit?: string | null
          created_at?: string
          id?: string
          log_date?: string
          logged_at?: string
          reps?: number
          slot?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      target_plans: {
        Row: {
          applied_at: string | null
          created_at: string
          daily_target: number
          effective_date: string
          frequency: number
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          daily_target: number
          effective_date: string
          frequency: number
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          daily_target?: number
          effective_date?: string
          frequency?: number
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          follow_shared_target: boolean
          id: string
          role: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          follow_shared_target?: boolean
          id?: string
          role?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          follow_shared_target?: boolean
          id?: string
          role?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
          shared_frequency: number | null
          shared_target: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          name?: string
          owner_id: string
          shared_frequency?: number | null
          shared_target?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          shared_frequency?: number | null
          shared_target?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          baseline_reps: number | null
          created_at: string
          daily_target: number
          disclaimer_accepted_at: string | null
          frequency: number
          onboarding_completed_at: string | null
          parq_passed: boolean
          reminders_enabled: boolean
          slot_times: string[]
          start_date: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_reps?: number | null
          created_at?: string
          daily_target?: number
          disclaimer_accepted_at?: string | null
          frequency?: number
          onboarding_completed_at?: string | null
          parq_passed?: boolean
          reminders_enabled?: boolean
          slot_times?: string[]
          start_date?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_reps?: number | null
          created_at?: string
          daily_target?: number
          disclaimer_accepted_at?: string | null
          frequency?: number
          onboarding_completed_at?: string | null
          parq_passed?: boolean
          reminders_enabled?: boolean
          slot_times?: string[]
          start_date?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
