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
      issue_events: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["issue_status"] | null
          id: string
          issue_id: string
          kind: string
          note: string | null
          to_status: Database["public"]["Enums"]["issue_status"] | null
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["issue_status"] | null
          id?: string
          issue_id: string
          kind: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["issue_status"] | null
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["issue_status"] | null
          id?: string
          issue_id?: string
          kind?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["issue_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_secrets: {
        Row: {
          created_at: string
          issue_id: string
          recovery_token: string
        }
        Insert: {
          created_at?: string
          issue_id: string
          recovery_token: string
        }
        Update: {
          created_at?: string
          issue_id?: string
          recovery_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_secrets_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: true
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          ai_confidence: number | null
          assigned_to: string | null
          category: string
          created_at: string
          department: string | null
          description: string | null
          duplicate_of: string | null
          id: string
          idempotency_key: string | null
          landmark: string | null
          lat: number
          lng: number
          photo_url: string | null
          ref_code: string
          resolved_at: string | null
          safety_warning: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          sla_due_at: string | null
          status: Database["public"]["Enums"]["issue_status"]
          subcategory: string | null
          summary: string | null
          support_count: number
          title: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          assigned_to?: string | null
          category?: string
          created_at?: string
          department?: string | null
          description?: string | null
          duplicate_of?: string | null
          id?: string
          idempotency_key?: string | null
          landmark?: string | null
          lat: number
          lng: number
          photo_url?: string | null
          ref_code: string
          resolved_at?: string | null
          safety_warning?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          subcategory?: string | null
          summary?: string | null
          support_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          assigned_to?: string | null
          category?: string
          created_at?: string
          department?: string | null
          description?: string | null
          duplicate_of?: string | null
          id?: string
          idempotency_key?: string | null
          landmark?: string | null
          lat?: number
          lng?: number
          photo_url?: string | null
          ref_code?: string
          resolved_at?: string | null
          safety_warning?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          subcategory?: string | null
          summary?: string | null
          support_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      nearby_issues: {
        Args: {
          _category: string
          _lat: number
          _lng: number
          _radius_m: number
        }
        Returns: {
          category: string
          created_at: string
          distance_m: number
          id: string
          ref_code: string
          status: Database["public"]["Enums"]["issue_status"]
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      issue_severity: "low" | "medium" | "high" | "critical"
      issue_status:
        | "needs_classification"
        | "submitted"
        | "under_review"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "rejected"
        | "reopened"
        | "closed"
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
    Enums: {
      app_role: ["admin", "staff"],
      issue_severity: ["low", "medium", "high", "critical"],
      issue_status: [
        "needs_classification",
        "submitted",
        "under_review",
        "assigned",
        "in_progress",
        "resolved",
        "rejected",
        "reopened",
        "closed",
      ],
    },
  },
} as const
