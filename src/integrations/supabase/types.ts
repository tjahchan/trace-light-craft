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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          created_at: string
          id: string
          initial_balance: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          initial_balance?: number
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          initial_balance?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_accounts: {
        Row: {
          account_name: string | null
          account_number_masked: string | null
          account_type: string | null
          broker_name: string | null
          connection_id: string
          created_at: string
          currency: string | null
          id: string
          is_selected_for_import: boolean
          snaptrade_account_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number_masked?: string | null
          account_type?: string | null
          broker_name?: string | null
          connection_id: string
          created_at?: string
          currency?: string | null
          id?: string
          is_selected_for_import?: boolean
          snaptrade_account_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number_masked?: string | null
          account_type?: string | null
          broker_name?: string | null
          connection_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_selected_for_import?: boolean
          snaptrade_account_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_activities_raw: {
        Row: {
          account_id: string
          activity_date: string | null
          created_at: string
          id: string
          import_batch_id: string | null
          raw_payload: Json | null
          source_activity_id: string | null
          source_provider: string
          symbol: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          activity_date?: string | null
          created_at?: string
          id?: string
          import_batch_id?: string | null
          raw_payload?: Json | null
          source_activity_id?: string | null
          source_provider?: string
          symbol?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          activity_date?: string | null
          created_at?: string
          id?: string
          import_batch_id?: string | null
          raw_payload?: Json | null
          source_activity_id?: string | null
          source_provider?: string
          symbol?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_activities_raw_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_connections: {
        Row: {
          broker_name: string | null
          connection_status: string
          created_at: string
          disabled: boolean
          id: string
          integration_id: string
          last_synced_at: string | null
          snaptrade_connection_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          broker_name?: string | null
          connection_status?: string
          created_at?: string
          disabled?: boolean
          id?: string
          integration_id: string
          last_synced_at?: string | null
          snaptrade_connection_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          broker_name?: string | null
          connection_status?: string
          created_at?: string
          disabled?: boolean
          id?: string
          integration_id?: string
          last_synced_at?: string | null
          snaptrade_connection_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_connections_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "broker_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_integrations: {
        Row: {
          created_at: string
          id: string
          provider: string
          snaptrade_user_id: string | null
          snaptrade_user_secret_encrypted: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider?: string
          snaptrade_user_id?: string | null
          snaptrade_user_secret_encrypted?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          snaptrade_user_id?: string | null
          snaptrade_user_secret_encrypted?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          likes: number
          parent_id: string | null
          user_id: string
          username: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes?: number
          parent_id?: string | null
          user_id: string
          username: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes?: number
          parent_id?: string | null
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          streak_reminders: boolean
          updated_at: string
          user_id: string
          weekly_encouragement: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          streak_reminders?: boolean
          updated_at?: string
          user_id: string
          weekly_encouragement?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          streak_reminders?: boolean
          updated_at?: string
          user_id?: string
          weekly_encouragement?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          account_id: string
          active: boolean
          amount: number
          created_at: string
          frequency: string
          id: string
          next_due_date: string
          note: string | null
          start_date: string
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          active?: boolean
          amount: number
          created_at?: string
          frequency?: string
          id?: string
          next_due_date?: string
          note?: string | null
          start_date?: string
          type?: string
          user_id: string
        }
        Update: {
          account_id?: string
          active?: boolean
          amount?: number
          created_at?: string
          frequency?: string
          id?: string
          next_due_date?: string
          note?: string | null
          start_date?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          account_id: string | null
          activities_imported: number | null
          completed_at: string | null
          connection_id: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          meta: Json | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          activities_imported?: number | null
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          meta?: Json | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          activities_imported?: number | null
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          meta?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "broker_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          account_id: string
          close_time: string | null
          commissions: number | null
          created_at: string
          entry_price: number
          exit_price: number | null
          id: string
          note: string | null
          open_time: string | null
          pnl: number | null
          quantity: number
          side: string
          sl: number | null
          status: string
          symbol: string
          tags: string[] | null
          tp: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          close_time?: string | null
          commissions?: number | null
          created_at?: string
          entry_price?: number
          exit_price?: number | null
          id?: string
          note?: string | null
          open_time?: string | null
          pnl?: number | null
          quantity?: number
          side?: string
          sl?: number | null
          status?: string
          symbol: string
          tags?: string[] | null
          tp?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          close_time?: string | null
          commissions?: number | null
          created_at?: string
          entry_price?: number
          exit_price?: number | null
          id?: string
          note?: string | null
          open_time?: string | null
          pnl?: number | null
          quantity?: number
          side?: string
          sl?: number | null
          status?: string
          symbol?: string
          tags?: string[] | null
          tp?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          type?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          best_streak: number
          created_at: string
          current_streak: number
          id: string
          last_active_date: string | null
          last_note_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_streak?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_active_date?: string | null
          last_note_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_streak?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_active_date?: string | null
          last_note_date?: string | null
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
      get_streak_leaderboard: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          best_streak: number
          current_streak: number
          display_name: string
          email: string
          rank: number
        }[]
      }
      like_post: { Args: { post_id: string }; Returns: undefined }
      record_note_activity: { Args: { p_user_id: string }; Returns: Json }
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
