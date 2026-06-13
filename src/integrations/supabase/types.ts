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
      anomaly_reports: {
        Row: {
          action_taken: string | null
          anomaly_type: string
          batch_id: string
          context: Json | null
          created_at: string
          id: string
          message: string
          recommendation: string | null
          resolved: boolean
          row_number: number | null
          severity: string
        }
        Insert: {
          action_taken?: string | null
          anomaly_type: string
          batch_id: string
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          recommendation?: string | null
          resolved?: boolean
          row_number?: number | null
          severity?: string
        }
        Update: {
          action_taken?: string | null
          anomaly_type?: string
          batch_id?: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          recommendation?: string | null
          resolved?: boolean
          row_number?: number | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_reports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          group_id: string | null
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          group_id?: string | null
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          group_id?: string | null
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          effective_date: string
          from_currency: string
          id: string
          rate: number
          to_currency: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          from_currency: string
          id?: string
          rate: number
          to_currency: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
        }
        Relationships: []
      }
      expense_splits: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          member_id: string
          share_amount_base: number
          share_input: number | null
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          member_id: string
          share_amount_base: number
          share_input?: number | null
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          member_id?: string
          share_amount_base?: number
          share_input?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_base: number
          amount_original: number
          category: string | null
          created_at: string
          currency: string
          date: string
          deleted_at: string | null
          description: string
          fx_rate: number
          group_id: string
          id: string
          import_batch_id: string | null
          notes: string | null
          paid_by_member_id: string | null
          source_row_number: number | null
          split_type: string
          updated_at: string
        }
        Insert: {
          amount_base: number
          amount_original: number
          category?: string | null
          created_at?: string
          currency: string
          date: string
          deleted_at?: string | null
          description: string
          fx_rate?: number
          group_id: string
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          paid_by_member_id?: string | null
          source_row_number?: number | null
          split_type: string
          updated_at?: string
        }
        Update: {
          amount_base?: number
          amount_original?: number
          category?: string | null
          created_at?: string
          currency?: string
          date?: string
          deleted_at?: string | null
          description?: string
          fx_rate?: number
          group_id?: string
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          paid_by_member_id?: string | null
          source_row_number?: number | null
          split_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_name: string
          group_id: string
          id: string
          is_guest: boolean
          join_date: string | null
          leave_date: string | null
          normalized_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_name: string
          group_id: string
          id?: string
          is_guest?: boolean
          join_date?: string | null
          leave_date?: string | null
          normalized_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          group_id?: string
          id?: string
          is_guest?: boolean
          join_date?: string | null
          leave_date?: string | null
          normalized_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          base_currency: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          anomaly_count: number
          committed_at: string | null
          created_at: string
          filename: string
          group_id: string
          id: string
          imported_rows: number
          owner_id: string
          skipped_rows: number
          status: string
          summary: Json | null
          total_rows: number
        }
        Insert: {
          anomaly_count?: number
          committed_at?: string | null
          created_at?: string
          filename: string
          group_id: string
          id?: string
          imported_rows?: number
          owner_id: string
          skipped_rows?: number
          status?: string
          summary?: Json | null
          total_rows?: number
        }
        Update: {
          anomaly_count?: number
          committed_at?: string | null
          created_at?: string
          filename?: string
          group_id?: string
          id?: string
          imported_rows?: number
          owner_id?: string
          skipped_rows?: number
          status?: string
          summary?: Json | null
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          batch_id: string
          created_at: string
          expense_id: string | null
          id: string
          parsed: Json | null
          raw: Json
          row_number: number
          settlement_id: string | null
          status: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          expense_id?: string | null
          id?: string
          parsed?: Json | null
          raw: Json
          row_number: number
          settlement_id?: string | null
          status?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          expense_id?: string | null
          id?: string
          parsed?: Json | null
          raw?: Json
          row_number?: number
          settlement_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount: number
          amount_base: number
          created_at: string
          currency: string
          date: string
          deleted_at: string | null
          from_member_id: string
          group_id: string
          id: string
          import_batch_id: string | null
          notes: string | null
          to_member_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_base: number
          created_at?: string
          currency: string
          date: string
          deleted_at?: string | null
          from_member_id: string
          group_id: string
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          to_member_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_base?: number
          created_at?: string
          currency?: string
          date?: string
          deleted_at?: string | null
          from_member_id?: string
          group_id?: string
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          to_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_group_owner: { Args: { _group_id: string }; Returns: boolean }
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
