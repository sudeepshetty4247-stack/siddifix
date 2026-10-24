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
      civic_ai_state: {
        Row: {
          id: string
          paused: boolean
          reason: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          paused?: boolean
          reason?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          paused?: boolean
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      civic_authorities: {
        Row: {
          active: boolean
          coverage_id: string | null
          id: string
          kind: string
          name: string
          notes: string
          phone: string | null
          reporting_url: string | null
          source_url: string
          verified_at: string
          website_url: string
        }
        Insert: {
          active?: boolean
          coverage_id?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string
          phone?: string | null
          reporting_url?: string | null
          source_url: string
          verified_at: string
          website_url: string
        }
        Update: {
          active?: boolean
          coverage_id?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string
          phone?: string | null
          reporting_url?: string | null
          source_url?: string
          verified_at?: string
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "civic_authorities_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "civic_coverage"
            referencedColumns: ["id"]
          },
        ]
      }
      civic_coverage: {
        Row: {
          bounds: Json
          enabled: boolean
          id: string
          name: string
          notice: string
          source_url: string | null
          state: string
          verified_at: string | null
        }
        Insert: {
          bounds: Json
          enabled?: boolean
          id: string
          name: string
          notice: string
          source_url?: string | null
          state?: string
          verified_at?: string | null
        }
        Update: {
          bounds?: Json
          enabled?: boolean
          id?: string
          name?: string
          notice?: string
          source_url?: string | null
          state?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      civic_department_routes: {
        Row: {
          active: boolean
          category: string
          contact_label: string | null
          contact_phone: string | null
          coverage_id: string
          fixing_team: string
          id: string
          notes: string
          officer_role: string
          receiving_office: string
          source_checked_at: string | null
          source_url: string | null
          updated_at: string
          updated_by: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          active?: boolean
          category: string
          contact_label?: string | null
          contact_phone?: string | null
          coverage_id: string
          fixing_team: string
          id?: string
          notes?: string
          officer_role: string
          receiving_office: string
          source_checked_at?: string | null
          source_url?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          contact_label?: string | null
          contact_phone?: string | null
          coverage_id?: string
          fixing_team?: string
          id?: string
          notes?: string
          officer_role?: string
          receiving_office?: string
          source_checked_at?: string | null
          source_url?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "civic_department_routes_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "civic_coverage"
            referencedColumns: ["id"]
          },
        ]
      }
      civic_directory_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_row: Json | null
          old_row: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      civic_people: {
        Row: {
          active: boolean
          category: string | null
          checked_at: string
          contact_email: string | null
          contact_phone: string | null
          corporation: string | null
          designation: string
          full_name: string
          id: string
          kind: string
          photo_credit: string | null
          photo_license_url: string | null
          photo_source_type: string | null
          photo_source_url: string | null
          photo_url: string | null
          photo_usage_notes: string | null
          photo_verified: boolean
          photo_verified_at: string | null
          source_url: string
          updated_at: string
          updated_by: string | null
          verification_status: string
          ward_identifier: string | null
          zone: string | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          checked_at?: string
          contact_email?: string | null
          contact_phone?: string | null
          corporation?: string | null
          designation: string
          full_name: string
          id?: string
          kind?: string
          photo_credit?: string | null
          photo_license_url?: string | null
          photo_source_type?: string | null
          photo_source_url?: string | null
          photo_url?: string | null
          photo_usage_notes?: string | null
          photo_verified?: boolean
          photo_verified_at?: string | null
          source_url: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: string
          ward_identifier?: string | null
          zone?: string | null
        }
        Update: {
          active?: boolean
          category?: string | null
          checked_at?: string
          contact_email?: string | null
          contact_phone?: string | null
          corporation?: string | null
          designation?: string
          full_name?: string
          id?: string
          kind?: string
          photo_credit?: string | null
          photo_license_url?: string | null
          photo_source_type?: string | null
          photo_source_url?: string | null
          photo_url?: string | null
          photo_usage_notes?: string | null
          photo_verified?: boolean
          photo_verified_at?: string | null
          source_url?: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: string
          ward_identifier?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      civic_request_limits: {
        Row: {
          hits: number
          key: string
          window_started_at: string
        }
        Insert: {
          hits?: number
          key: string
          window_started_at?: string
        }
        Update: {
          hits?: number
          key?: string
          window_started_at?: string
        }
        Relationships: []
      }
      civic_service_rules: {
        Row: {
          authority_id: string
          category: string
          confidence: string
          id: string
          notes: string
          source_url: string
          subcategory: string | null
        }
        Insert: {
          authority_id: string
          category: string
          confidence?: string
          id?: string
          notes?: string
          source_url: string
          subcategory?: string | null
        }
        Update: {
          authority_id?: string
          category?: string
          confidence?: string
          id?: string
          notes?: string
          source_url?: string
          subcategory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "civic_service_rules_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "civic_authorities"
            referencedColumns: ["id"]
          },
        ]
      }
      civic_teams: {
        Row: {
          active: boolean
          categories: string[]
          contact_label: string | null
          contact_phone: string | null
          created_at: string
          department: string
          id: string
          is_fallback: boolean
          name: string
          notes: string
          supervisor_id: string | null
          updated_at: string
          updated_by: string | null
          wards: string[]
        }
        Insert: {
          active?: boolean
          categories?: string[]
          contact_label?: string | null
          contact_phone?: string | null
          created_at?: string
          department: string
          id?: string
          is_fallback?: boolean
          name: string
          notes?: string
          supervisor_id?: string | null
          updated_at?: string
          updated_by?: string | null
          wards?: string[]
        }
        Update: {
          active?: boolean
          categories?: string[]
          contact_label?: string | null
          contact_phone?: string | null
          created_at?: string
          department?: string
          id?: string
          is_fallback?: boolean
          name?: string
          notes?: string
          supervisor_id?: string | null
          updated_at?: string
          updated_by?: string | null
          wards?: string[]
        }
        Relationships: []
      }
      civic_wards: {
        Row: {
          active: boolean
          assembly: string | null
          assembly_no: number | null
          boundary: Json
          corporation: string
          coverage_id: string
          flags: string[]
          id: string
          identifier: string
          lok_sabha: string | null
          mla: string | null
          mla_party: string | null
          mp: string | null
          name: string
          name_kn: string | null
          notes: string
          official_name: string | null
          population: number | null
          representative: string | null
          representative_source_url: string | null
          representative_status: string
          source_checked_at: string | null
          source_published_at: string | null
          source_sha256: string | null
          source_url: string
          updated_at: string
          updated_by: string | null
          verification_status: string
          verified_at: string
          ward_number: number | null
          zone: string | null
        }
        Insert: {
          active?: boolean
          assembly?: string | null
          assembly_no?: number | null
          boundary: Json
          corporation: string
          coverage_id: string
          flags?: string[]
          id?: string
          identifier: string
          lok_sabha?: string | null
          mla?: string | null
          mla_party?: string | null
          mp?: string | null
          name: string
          name_kn?: string | null
          notes?: string
          official_name?: string | null
          population?: number | null
          representative?: string | null
          representative_source_url?: string | null
          representative_status?: string
          source_checked_at?: string | null
          source_published_at?: string | null
          source_sha256?: string | null
          source_url: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: string
          verified_at: string
          ward_number?: number | null
          zone?: string | null
        }
        Update: {
          active?: boolean
          assembly?: string | null
          assembly_no?: number | null
          boundary?: Json
          corporation?: string
          coverage_id?: string
          flags?: string[]
          id?: string
          identifier?: string
          lok_sabha?: string | null
          mla?: string | null
          mla_party?: string | null
          mp?: string | null
          name?: string
          name_kn?: string | null
          notes?: string
          official_name?: string | null
          population?: number | null
          representative?: string | null
          representative_source_url?: string | null
          representative_status?: string
          source_checked_at?: string | null
          source_published_at?: string | null
          source_sha256?: string | null
          source_url?: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: string
          verified_at?: string
          ward_number?: number | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "civic_wards_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "civic_coverage"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_assignments: {
        Row: {
          action: string
          actor_id: string
          authority_id: string | null
          created_at: string
          id: string
          issue_id: string
          reason: string
        }
        Insert: {
          action: string
          actor_id: string
          authority_id?: string | null
          created_at?: string
          id?: string
          issue_id: string
          reason: string
        }
        Update: {
          action?: string
          actor_id?: string
          authority_id?: string | null
          created_at?: string
          id?: string
          issue_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_assignments_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "civic_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_assignments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_duplicate_reviews: {
        Row: {
          actor_id: string
          candidate_id: string
          created_at: string
          decision: string
          id: string
          previous_parent: string | null
          reason: string
          report_id: string
        }
        Insert: {
          actor_id: string
          candidate_id: string
          created_at?: string
          decision: string
          id?: string
          previous_parent?: string | null
          reason: string
          report_id: string
        }
        Update: {
          actor_id?: string
          candidate_id?: string
          created_at?: string
          decision?: string
          id?: string
          previous_parent?: string | null
          reason?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_duplicate_reviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_duplicate_reviews_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
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
      issue_evidence: {
        Row: {
          actor_id: string
          id: string
          issue_id: string
          kind: string
          note: string
          recorded_at: string
          storage_path: string
        }
        Insert: {
          actor_id: string
          id?: string
          issue_id: string
          kind: string
          note: string
          recorded_at?: string
          storage_path: string
        }
        Update: {
          actor_id?: string
          id?: string
          issue_id?: string
          kind?: string
          note?: string
          recorded_at?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_evidence_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_notifications: {
        Row: {
          attempts: number
          audience: string
          channel: string
          created_at: string
          detail: string
          id: string
          issue_id: string
          status: string
        }
        Insert: {
          attempts?: number
          audience: string
          channel: string
          created_at?: string
          detail?: string
          id?: string
          issue_id: string
          status: string
        }
        Update: {
          attempts?: number
          audience?: string
          channel?: string
          created_at?: string
          detail?: string
          id?: string
          issue_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_notifications_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_ownership_reviews: {
        Row: {
          created_at: string
          issue_id: string
          reason: string
          state: string
        }
        Insert: {
          created_at?: string
          issue_id: string
          reason?: string
          state?: string
        }
        Update: {
          created_at?: string
          issue_id?: string
          reason?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_ownership_reviews_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: true
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_photos: {
        Row: {
          annotated_path: string | null
          created_at: string
          display_path: string
          id: string
          issue_id: string
          metadata: Json
          original_path: string
          original_sha256: string
          source: string
        }
        Insert: {
          annotated_path?: string | null
          created_at?: string
          display_path: string
          id?: string
          issue_id: string
          metadata?: Json
          original_path: string
          original_sha256: string
          source?: string
        }
        Update: {
          annotated_path?: string | null
          created_at?: string
          display_path?: string
          id?: string
          issue_id?: string
          metadata?: Json
          original_path?: string
          original_sha256?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_photos_issue_id_fkey"
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
          token_hash: string | null
        }
        Insert: {
          created_at?: string
          issue_id: string
          recovery_token: string
          token_hash?: string | null
        }
        Update: {
          created_at?: string
          issue_id?: string
          recovery_token?: string
          token_hash?: string | null
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
          ack_message: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          ai_confidence: number | null
          assigned_to: string | null
          assignment_state: string
          authority_id: string | null
          category: string
          created_at: string
          department: string | null
          description: string | null
          duplicate_candidate_id: string | null
          duplicate_of: string | null
          escalated_at: string | null
          eta_at: string | null
          id: string
          idempotency_key: string | null
          inspection_at: string | null
          landmark: string | null
          lat: number
          lng: number
          photo_url: string | null
          ref_code: string
          resolved_at: string | null
          routing_snapshot: Json | null
          safety_warning: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          sla_due_at: string | null
          status: Database["public"]["Enums"]["issue_status"]
          subcategory: string | null
          summary: string | null
          support_count: number
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ack_message?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ai_confidence?: number | null
          assigned_to?: string | null
          assignment_state?: string
          authority_id?: string | null
          category?: string
          created_at?: string
          department?: string | null
          description?: string | null
          duplicate_candidate_id?: string | null
          duplicate_of?: string | null
          escalated_at?: string | null
          eta_at?: string | null
          id?: string
          idempotency_key?: string | null
          inspection_at?: string | null
          landmark?: string | null
          lat: number
          lng: number
          photo_url?: string | null
          ref_code: string
          resolved_at?: string | null
          routing_snapshot?: Json | null
          safety_warning?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          subcategory?: string | null
          summary?: string | null
          support_count?: number
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ack_message?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ai_confidence?: number | null
          assigned_to?: string | null
          assignment_state?: string
          authority_id?: string | null
          category?: string
          created_at?: string
          department?: string | null
          description?: string | null
          duplicate_candidate_id?: string | null
          duplicate_of?: string | null
          escalated_at?: string | null
          eta_at?: string | null
          id?: string
          idempotency_key?: string | null
          inspection_at?: string | null
          landmark?: string | null
          lat?: number
          lng?: number
          photo_url?: string | null
          ref_code?: string
          resolved_at?: string | null
          routing_snapshot?: Json | null
          safety_warning?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          subcategory?: string | null
          summary?: string | null
          support_count?: number
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "civic_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_duplicate_candidate_id_fkey"
            columns: ["duplicate_candidate_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          categories: string[]
          department: string
          designation: string
          display_name: string
          updated_at: string
          user_id: string
          wards: string[]
        }
        Insert: {
          categories?: string[]
          department?: string
          designation?: string
          display_name?: string
          updated_at?: string
          user_id: string
          wards?: string[]
        }
        Update: {
          categories?: string[]
          department?: string
          designation?: string
          display_name?: string
          updated_at?: string
          user_id?: string
          wards?: string[]
        }
        Relationships: []
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
      admin_set_staff_profile: {
        Args: {
          _categories: string[]
          _department: string
          _designation: string
          _name: string
          _user: string
          _wards: string[]
        }
        Returns: undefined
      }
      admin_upsert_team: {
        Args: {
          _active: boolean
          _categories: string[]
          _contact_label: string
          _contact_phone: string
          _department: string
          _fallback: boolean
          _id: string
          _name: string
          _notes: string
          _supervisor: string
          _wards: string[]
        }
        Returns: string
      }
      assign_civic_issue: {
        Args: {
          _action: string
          _authority: string
          _id: string
          _reason: string
        }
        Returns: undefined
      }
      citizen_change_issue: {
        Args: { _action: string; _note: string; _ref: string; _token: string }
        Returns: string
      }
      civic_case_metrics: { Args: never; Returns: Json }
      consume_civic_request: {
        Args: { _key: string; _limit: number }
        Returns: boolean
      }
      create_civic_report: {
        Args: { _report: Json; _token: string }
        Returns: Json
      }
      escalate_overdue_issues: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_supervisor: { Args: { _user_id: string }; Returns: boolean }
      nearby_case_summary: {
        Args: { _lat: number; _lng: number; _radius_m?: number }
        Returns: Json
      }
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
      public_case_events: { Args: { _id: string }; Returns: Json }
      public_case_rows: { Args: { _ref?: string }; Returns: Json }
      public_transparency_metrics: { Args: { _days?: number }; Returns: Json }
      review_issue_duplicate: {
        Args: {
          _candidate: string
          _decision: string
          _reason: string
          _report: string
        }
        Returns: undefined
      }
      route_issue_to_team: { Args: { _issue: string }; Returns: string }
      staff_acknowledge_issue: {
        Args: {
          _eta: string
          _expected: Database["public"]["Enums"]["issue_status"]
          _id: string
          _inspection: string
          _message: string
        }
        Returns: undefined
      }
      staff_actor_label: { Args: { _user_id: string }; Returns: string }
      staff_add_note: {
        Args: { _issue: string; _note: string }
        Returns: undefined
      }
      staff_assign_team: {
        Args: { _issue: string; _reason: string; _team: string }
        Returns: undefined
      }
      staff_can_work: {
        Args: { _issue: string; _user_id: string }
        Returns: boolean
      }
      staff_change_issue: {
        Args: {
          _expected: Database["public"]["Enums"]["issue_status"]
          _id: string
          _next: Database["public"]["Enums"]["issue_status"]
          _note: string
        }
        Returns: undefined
      }
      staff_edit_classification: {
        Args: {
          _category: string
          _id: string
          _note: string
          _severity: Database["public"]["Enums"]["issue_severity"]
        }
        Returns: undefined
      }
      staff_queue_issues: {
        Args: {
          _ack?: string
          _category?: string
          _limit?: number
          _overdue?: boolean
          _search?: string
          _severity?: string
          _status?: string
          _team?: string
          _ward?: string
        }
        Returns: {
          acknowledged_at: string
          assignment_state: string
          authority_id: string
          category: string
          created_at: string
          department: string
          duplicate_candidate_id: string
          duplicate_of: string
          escalated_at: string
          eta_at: string
          id: string
          landmark: string
          photo_url: string
          ref_code: string
          severity: Database["public"]["Enums"]["issue_severity"]
          sla_due_at: string
          status: Database["public"]["Enums"]["issue_status"]
          support_count: number
          team_id: string
          team_name: string
          title: string
          ward_name: string
        }[]
      }
      staff_record_evidence: {
        Args: { _id: string; _kind: string; _note: string; _path: string }
        Returns: string
      }
      staff_update_eta: {
        Args: { _eta: string; _id: string; _reason: string }
        Returns: undefined
      }
      verify_reporter_token: {
        Args: { _ref: string; _token: string }
        Returns: boolean
      }
      ward_at_point: {
        Args: { _lat: number; _lng: number }
        Returns: {
          corporation: string
          name: string
          ward_number: number
          zone: string
        }[]
      }
      ward_case_counts: {
        Args: never
        Returns: {
          reports: number
          resolved: number
          unique_issues: number
          unresolved: number
          ward_identifier: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "supervisor" | "field_worker"
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
        | "accepted"
        | "inspection_scheduled"
        | "awaiting_verification"
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
      app_role: ["admin", "staff", "supervisor", "field_worker"],
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
        "accepted",
        "inspection_scheduled",
        "awaiting_verification",
      ],
    },
  },
} as const
