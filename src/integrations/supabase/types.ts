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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          amount: number
          audio_note_url: string | null
          assignment_id: string | null
          category: string
          created_at: string
          id: string
          notes: string | null
          transaction_type: string
          worker_profile_id: string
        }
        Insert: {
          amount?: number
          audio_note_url?: string | null
          assignment_id?: string | null
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          transaction_type?: string
          worker_profile_id: string
        }
        Update: {
          amount?: number
          audio_note_url?: string | null
          assignment_id?: string | null
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          transaction_type?: string
          worker_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "work_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_worker_profile_id_fkey"
            columns: ["worker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          login_name: string
          password_plain: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
          wallet_balance: number
          worker_type: Database["public"]["Enums"]["worker_type"] | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          login_name: string
          password_plain?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
          wallet_balance?: number
          worker_type?: Database["public"]["Enums"]["worker_type"] | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          login_name?: string
          password_plain?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
          wallet_balance?: number
          worker_type?: Database["public"]["Enums"]["worker_type"] | null
        }
        Relationships: []
      }
      work_assignments: {
        Row: {
          admin_review_status: string | null
          admin_review_notes: string | null
          admin_review_voice_note_url: string | null
          admin_reviewed_at: string | null
          admin_reviewed_by: string | null
          assignment_note_audio_url: string | null
          completed_at: string | null
          created_at: string
          employee_review_notes: string | null
          employee_review_voice_note_url: string | null
          id: string
          image_url: string | null
          notes: string | null
          num_meters: number | null
          num_pieces: number
          paid_at: string | null
          payout_amount: number
          price_per_piece: number
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submission_image_url: string | null
          submission_notes: string | null
          submission_voice_note_url: string | null
          submitted_at: string | null
          task_name: string
          total_amount: number
          updated_at: string
          worker_created: boolean
          worker_id: string
        }
        Insert: {
          admin_review_status?: string | null
          admin_review_notes?: string | null
          admin_review_voice_note_url?: string | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          assignment_note_audio_url?: string | null
          completed_at?: string | null
          created_at?: string
          employee_review_notes?: string | null
          employee_review_voice_note_url?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          num_meters?: number | null
          num_pieces?: number
          paid_at?: string | null
          payout_amount?: number
          price_per_piece?: number
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_image_url?: string | null
          submission_notes?: string | null
          submission_voice_note_url?: string | null
          submitted_at?: string | null
          task_name?: string
          total_amount?: number
          updated_at?: string
          worker_created?: boolean
          worker_id: string
        }
        Update: {
          admin_review_status?: string | null
          admin_review_notes?: string | null
          admin_review_voice_note_url?: string | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          assignment_note_audio_url?: string | null
          completed_at?: string | null
          created_at?: string
          employee_review_notes?: string | null
          employee_review_voice_note_url?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          num_meters?: number | null
          num_pieces?: number
          paid_at?: string | null
          payout_amount?: number
          price_per_piece?: number
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_image_url?: string | null
          submission_notes?: string | null
          submission_voice_note_url?: string | null
          submitted_at?: string | null
          task_name?: string
          total_amount?: number
          updated_at?: string
          worker_created?: boolean
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_auth_email_by_login_name: {
        Args: { _login_name: string }
        Returns: string
      }
      get_email_by_name: {
        Args: { _name: string; _role?: Database["public"]["Enums"]["app_role"] }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "worker" | "employee"
      worker_type: "dyer" | "normal"
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
    Enums: {
      app_role: ["admin", "worker", "employee"],
      worker_type: ["dyer", "normal"],
    },
  },
} as const
