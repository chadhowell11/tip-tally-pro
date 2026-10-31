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
      app_settings: {
        Row: {
          bar_tip_pct: number
          bartender_tip_pct: number
          cc_fee_enabled: boolean
          cc_fee_pct: number
          establishment_name: string
          id: number
          location_id: string
          logo_url: string | null
          manager_exclusion_enabled: boolean
          max_tipout_pct: number
          pay_period_anchor: string | null
          pay_period_type: string
          rb_basis: string
          rounding_mode: string
          runner_busser_tip_pct: number
          sales_tax_pct: number
          sms_enabled: boolean
          sms_from_number: string | null
          sms_include_breakdown: boolean
          updated_at: string
          use_net_sales: boolean
          weight_bar_back: number
          weight_busser: number
          weight_hostess: number
          weight_runner: number
        }
        Insert: {
          bar_tip_pct?: number
          bartender_tip_pct?: number
          cc_fee_enabled?: boolean
          cc_fee_pct?: number
          establishment_name?: string
          id?: number
          location_id: string
          logo_url?: string | null
          manager_exclusion_enabled?: boolean
          max_tipout_pct?: number
          pay_period_anchor?: string | null
          pay_period_type?: string
          rb_basis?: string
          rounding_mode?: string
          runner_busser_tip_pct?: number
          sales_tax_pct?: number
          sms_enabled?: boolean
          sms_from_number?: string | null
          sms_include_breakdown?: boolean
          updated_at?: string
          use_net_sales?: boolean
          weight_bar_back?: number
          weight_busser?: number
          weight_hostess?: number
          weight_runner?: number
        }
        Update: {
          bar_tip_pct?: number
          bartender_tip_pct?: number
          cc_fee_enabled?: boolean
          cc_fee_pct?: number
          establishment_name?: string
          id?: number
          location_id?: string
          logo_url?: string | null
          manager_exclusion_enabled?: boolean
          max_tipout_pct?: number
          pay_period_anchor?: string | null
          pay_period_type?: string
          rb_basis?: string
          rounding_mode?: string
          runner_busser_tip_pct?: number
          sales_tax_pct?: number
          sms_enabled?: boolean
          sms_from_number?: string | null
          sms_include_breakdown?: boolean
          updated_at?: string
          use_net_sales?: boolean
          weight_bar_back?: number
          weight_busser?: number
          weight_hostess?: number
          weight_runner?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          location_id: string
          role: Database["public"]["Enums"]["location_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          location_id: string
          role: Database["public"]["Enums"]["location_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          location_id?: string
          role?: Database["public"]["Enums"]["location_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_invites_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_members: {
        Row: {
          created_at: string
          id: string
          location_id: string
          role: Database["public"]["Enums"]["location_role"]
          staff_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          role: Database["public"]["Enums"]["location_role"]
          staff_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          role?: Database["public"]["Enums"]["location_role"]
          staff_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_members_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_members_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          current_period_end: string | null
          establishment_type: string | null
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string
          plan: string | null
          setup_completed_at: string | null
          setup_steps: Json
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          current_period_end?: string | null
          establishment_type?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id: string
          plan?: string | null
          setup_completed_at?: string | null
          setup_steps?: Json
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          current_period_end?: string | null
          establishment_type?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          plan?: string | null
          setup_completed_at?: string | null
          setup_steps?: Json
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings_audit: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          field: string
          id: string
          location_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          field: string
          id?: string
          location_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          field?: string
          id?: string
          location_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_audit_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_bartender_members: {
        Row: {
          created_at: string
          hours_worked: number
          id: string
          shift_bartender_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hours_worked?: number
          id?: string
          shift_bartender_id: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hours_worked?: number
          id?: string
          shift_bartender_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_bartender_members_shift_bartender_id_fkey"
            columns: ["shift_bartender_id"]
            isOneToOne: false
            referencedRelation: "shift_bartenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_bartender_members_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_bartenders: {
        Row: {
          cash_owed: number
          created_at: string
          credit_tips: number
          id: string
          rb_tip_override: number | null
          shift_id: string
          split_mode: string
          staff_id: string | null
          total_sales: number
        }
        Insert: {
          cash_owed?: number
          created_at?: string
          credit_tips?: number
          id?: string
          rb_tip_override?: number | null
          shift_id: string
          split_mode?: string
          staff_id?: string | null
          total_sales?: number
        }
        Update: {
          cash_owed?: number
          created_at?: string
          credit_tips?: number
          id?: string
          rb_tip_override?: number | null
          shift_id?: string
          split_mode?: string
          staff_id?: string | null
          total_sales?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_bartenders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_bartenders_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_server_members: {
        Row: {
          created_at: string
          hours_worked: number
          id: string
          shift_server_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hours_worked?: number
          id?: string
          shift_server_id: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hours_worked?: number
          id?: string
          shift_server_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_server_members_shift_server_id_fkey"
            columns: ["shift_server_id"]
            isOneToOne: false
            referencedRelation: "shift_servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_server_members_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_servers: {
        Row: {
          bar_tip_override: number | null
          cash_owed: number
          created_at: string
          credit_tips: number
          id: string
          lbw_sales: number
          rb_tip_override: number | null
          shift_id: string
          split_mode: string
          staff_id: string | null
          total_sales: number
        }
        Insert: {
          bar_tip_override?: number | null
          cash_owed?: number
          created_at?: string
          credit_tips?: number
          id?: string
          lbw_sales?: number
          rb_tip_override?: number | null
          shift_id: string
          split_mode?: string
          staff_id?: string | null
          total_sales?: number
        }
        Update: {
          bar_tip_override?: number | null
          cash_owed?: number
          created_at?: string
          credit_tips?: number
          id?: string
          lbw_sales?: number
          rb_tip_override?: number | null
          shift_id?: string
          split_mode?: string
          staff_id?: string | null
          total_sales?: number
        }
        Relationships: [
          {
            foreignKeyName: "shift_servers_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_servers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_support: {
        Row: {
          created_at: string
          hours_worked: number
          id: string
          role: Database["public"]["Enums"]["staff_role"] | null
          shift_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          hours_worked?: number
          id?: string
          role?: Database["public"]["Enums"]["staff_role"] | null
          shift_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          hours_worked?: number
          id?: string
          role?: Database["public"]["Enums"]["staff_role"] | null
          shift_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_support_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_support_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          notes: string | null
          period: Database["public"]["Enums"]["shift_period"]
          shift_date: string
          support_split_mode: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          period: Database["public"]["Enums"]["shift_period"]
          shift_date: string
          support_split_mode?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          period?: Database["public"]["Enums"]["shift_period"]
          shift_date?: string
          support_split_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_sends: {
        Row: {
          body: string
          created_at: string
          error: string | null
          id: string
          location_id: string
          phone: string
          provider_sid: string | null
          sent_by: string | null
          shift_id: string | null
          staff_id: string | null
          status: string
        }
        Insert: {
          body: string
          created_at?: string
          error?: string | null
          id?: string
          location_id: string
          phone: string
          provider_sid?: string | null
          sent_by?: string | null
          shift_id?: string | null
          staff_id?: string | null
          status?: string
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          id?: string
          location_id?: string
          phone?: string
          provider_sid?: string | null
          sent_by?: string | null
          shift_id?: string | null
          staff_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_sends_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_sends_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_sends_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          id: string
          is_manager: boolean
          location_id: string | null
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          server_number: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          is_manager?: boolean
          location_id?: string | null
          name: string
          phone?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          server_number?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          is_manager?: boolean
          location_id?: string | null
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          server_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_positions: {
        Row: {
          created_at: string
          position: Database["public"]["Enums"]["staff_role"]
          staff_id: string
        }
        Insert: {
          created_at?: string
          position: Database["public"]["Enums"]["staff_role"]
          staff_id: string
        }
        Update: {
          created_at?: string
          position?: Database["public"]["Enums"]["staff_role"]
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_positions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_override_audit: {
        Row: {
          action: string
          auto_amount: number | null
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          entry_id: string | null
          entry_kind: string
          field: string
          id: string
          location_id: string
          new_amount: number | null
          old_amount: number | null
          period: string | null
          shift_date: string | null
          shift_id: string | null
          staff_id: string | null
        }
        Insert: {
          action: string
          auto_amount?: number | null
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          entry_id?: string | null
          entry_kind: string
          field: string
          id?: string
          location_id: string
          new_amount?: number | null
          old_amount?: number | null
          period?: string | null
          shift_date?: string | null
          shift_id?: string | null
          staff_id?: string | null
        }
        Update: {
          action?: string
          auto_amount?: number | null
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          entry_id?: string | null
          entry_kind?: string
          field?: string
          id?: string
          location_id?: string
          new_amount?: number | null
          old_amount?: number | null
          period?: string | null
          shift_date?: string | null
          shift_id?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tip_override_audit_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_override_audit_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_override_audit_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      accept_location_invite: { Args: { _token: string }; Returns: string }
      can_admin_location: {
        Args: { _location_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_location: {
        Args: { _location_id: string; _user_id: string }
        Returns: boolean
      }
      has_location_role: {
        Args: {
          _location_id: string
          _role: Database["public"]["Enums"]["location_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_location_member: {
        Args: { _location_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      location_role: "owner" | "manager" | "staff" | "admin"
      shift_period: "AM" | "PM"
      staff_role:
        | "server"
        | "bartender"
        | "runner"
        | "busser"
        | "bar_back"
        | "hostess"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
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
      app_role: ["admin", "user"],
      location_role: ["owner", "manager", "staff", "admin"],
      shift_period: ["AM", "PM"],
      staff_role: [
        "server",
        "bartender",
        "runner",
        "busser",
        "bar_back",
        "hostess",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
    },
  },
} as const
