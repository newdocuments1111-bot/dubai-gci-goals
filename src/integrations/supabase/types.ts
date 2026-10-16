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
      ai_reply_settings: {
        Row: {
          agency_name: string
          fees: Json
          id: string
          rules: Json
          updated_at: string
        }
        Insert: {
          agency_name?: string
          fees?: Json
          id?: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          agency_name?: string
          fees?: Json
          id?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          kind: string
          lead_id: string | null
          message: string
          read: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          lead_id?: string | null
          message: string
          read?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          message?: string
          read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "alerts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          agency_name: string
          agent_name: string
          compliance_email: string
          holidays: string[]
          id: string
          mortgage_partner: string
          rera_brn: string
          retention_years: number
          updated_at: string
          viewing_minutes: number
          work_end: string
          work_start: string
          working_days: string[]
        }
        Insert: {
          agency_name?: string
          agent_name?: string
          compliance_email?: string
          holidays?: string[]
          id?: string
          mortgage_partner?: string
          rera_brn?: string
          retention_years?: number
          updated_at?: string
          viewing_minutes?: number
          work_end?: string
          work_start?: string
          working_days?: string[]
        }
        Update: {
          agency_name?: string
          agent_name?: string
          compliance_email?: string
          holidays?: string[]
          id?: string
          mortgage_partner?: string
          rera_brn?: string
          retention_years?: number
          updated_at?: string
          viewing_minutes?: number
          work_end?: string
          work_start?: string
          working_days?: string[]
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          language: string
          lead_id: string
          original_content: string | null
          role: string
          sent: boolean
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          language?: string
          lead_id: string
          original_content?: string | null
          role: string
          sent?: boolean
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          language?: string
          lead_id?: string
          original_content?: string | null
          role?: string
          sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_log: {
        Row: {
          agreed_to: string
          created_at: string
          how: string
          id: string
          lead_id: string
        }
        Insert: {
          agreed_to: string
          created_at?: string
          how?: string
          id?: string
          lead_id: string
        }
        Update: {
          agreed_to?: string
          created_at?: string
          how?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      document_log: {
        Row: {
          action: string
          client_name: string
          created_at: string
          id: string
          path: string
        }
        Insert: {
          action: string
          client_name: string
          created_at?: string
          id?: string
          path: string
        }
        Update: {
          action?: string
          client_name?: string
          created_at?: string
          id?: string
          path?: string
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          created_at: string
          draft: string
          id: string
          kind: string
          lead_id: string | null
          owner_id: string | null
          send_after: string | null
          status: string
        }
        Insert: {
          created_at?: string
          draft: string
          id?: string
          kind?: string
          lead_id?: string | null
          owner_id?: string | null
          send_after?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          draft?: string
          id?: string
          kind?: string
          lead_id?: string | null
          owner_id?: string | null
          send_after?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_paused: boolean
          created_at: string
          flagged: boolean
          hubspot_id: string | null
          id: string
          last_message_at: string | null
          learned: Json
          name: string
          opted_in: boolean
          phone: string
          score: string
          source: string
          stopped: boolean
          timezone: string
          type: string
        }
        Insert: {
          ai_paused?: boolean
          created_at?: string
          flagged?: boolean
          hubspot_id?: string | null
          id?: string
          last_message_at?: string | null
          learned?: Json
          name?: string
          opted_in?: boolean
          phone?: string
          score?: string
          source?: string
          stopped?: boolean
          timezone?: string
          type?: string
        }
        Update: {
          ai_paused?: boolean
          created_at?: string
          flagged?: boolean
          hubspot_id?: string | null
          id?: string
          last_message_at?: string | null
          learned?: Json
          name?: string
          opted_in?: boolean
          phone?: string
          score?: string
          source?: string
          stopped?: boolean
          timezone?: string
          type?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          agent_highlights: string
          amenity_gym: boolean | null
          amenity_kids_play_area: boolean | null
          amenity_pool: boolean | null
          amenity_security: boolean | null
          bedrooms: number
          community: string
          completion: string
          construction_percent: number | null
          created_at: string
          description: string
          developer: string
          do_not_mention: string
          external_id: string | null
          floor: string
          floor_plan: string
          furnishing: string
          handover_date: string | null
          id: string
          is_sample: boolean
          last_checked: string
          maps_url: string
          nearby_beach: string
          nearby_clinics: string
          nearby_malls: string
          nearby_metro: string
          nearby_parks: string
          nearby_schools: string
          nearby_supermarket: string
          needs_check: boolean
          parking_spaces: number | null
          payment_plan: string
          permit_number: string
          photos: string[]
          price_aed: number
          project: string
          property_type: string
          service_charge_aed_sqft_year: number | null
          size_sqft: number
          source: string
          status: string
          title: string
          updated_at: string
          video_tour_url: string
          videos: string[]
          view: string
        }
        Insert: {
          agent_highlights?: string
          amenity_gym?: boolean | null
          amenity_kids_play_area?: boolean | null
          amenity_pool?: boolean | null
          amenity_security?: boolean | null
          bedrooms?: number
          community?: string
          completion?: string
          construction_percent?: number | null
          created_at?: string
          description?: string
          developer?: string
          do_not_mention?: string
          external_id?: string | null
          floor?: string
          floor_plan?: string
          furnishing?: string
          handover_date?: string | null
          id?: string
          is_sample?: boolean
          last_checked?: string
          maps_url?: string
          nearby_beach?: string
          nearby_clinics?: string
          nearby_malls?: string
          nearby_metro?: string
          nearby_parks?: string
          nearby_schools?: string
          nearby_supermarket?: string
          needs_check?: boolean
          parking_spaces?: number | null
          payment_plan?: string
          permit_number?: string
          photos?: string[]
          price_aed?: number
          project?: string
          property_type?: string
          service_charge_aed_sqft_year?: number | null
          size_sqft?: number
          source?: string
          status?: string
          title: string
          updated_at?: string
          video_tour_url?: string
          videos?: string[]
          view?: string
        }
        Update: {
          agent_highlights?: string
          amenity_gym?: boolean | null
          amenity_kids_play_area?: boolean | null
          amenity_pool?: boolean | null
          amenity_security?: boolean | null
          bedrooms?: number
          community?: string
          completion?: string
          construction_percent?: number | null
          created_at?: string
          description?: string
          developer?: string
          do_not_mention?: string
          external_id?: string | null
          floor?: string
          floor_plan?: string
          furnishing?: string
          handover_date?: string | null
          id?: string
          is_sample?: boolean
          last_checked?: string
          maps_url?: string
          nearby_beach?: string
          nearby_clinics?: string
          nearby_malls?: string
          nearby_metro?: string
          nearby_parks?: string
          nearby_schools?: string
          nearby_supermarket?: string
          needs_check?: boolean
          parking_spaces?: number | null
          payment_plan?: string
          permit_number?: string
          photos?: string[]
          price_aed?: number
          project?: string
          property_type?: string
          service_charge_aed_sqft_year?: number | null
          size_sqft?: number
          source?: string
          status?: string
          title?: string
          updated_at?: string
          video_tour_url?: string
          videos?: string[]
          view?: string
        }
        Relationships: []
      }
      market_transactions: {
        Row: {
          area: string
          building: string
          id: string
          imported_at: string
          price_aed: number
          property_type: string
          size_sqft: number
          source: string
          transaction_date: string
        }
        Insert: {
          area: string
          building?: string
          id?: string
          imported_at?: string
          price_aed: number
          property_type?: string
          size_sqft?: number
          source?: string
          transaction_date: string
        }
        Update: {
          area?: string
          building?: string
          id?: string
          imported_at?: string
          price_aed?: number
          property_type?: string
          size_sqft?: number
          source?: string
          transaction_date?: string
        }
        Relationships: []
      }
      owners: {
        Row: {
          agreed_to_updates: boolean
          area: string
          building: string
          created_at: string
          handover_date: string | null
          id: string
          kind: string
          lease_end: string | null
          name: string
          phone: string
          update_frequency: string
        }
        Insert: {
          agreed_to_updates?: boolean
          area?: string
          building?: string
          created_at?: string
          handover_date?: string | null
          id?: string
          kind?: string
          lease_end?: string | null
          name: string
          phone?: string
          update_frequency?: string
        }
        Update: {
          agreed_to_updates?: boolean
          area?: string
          building?: string
          created_at?: string
          handover_date?: string | null
          id?: string
          kind?: string
          lease_end?: string | null
          name?: string
          phone?: string
          update_frequency?: string
        }
        Relationships: []
      }
      payment_schedules: {
        Row: {
          amount_aed: number
          created_at: string
          due_date: string
          id: string
          label: string
          lead_id: string | null
          listing_id: string | null
          milestone: string | null
          paid: boolean
        }
        Insert: {
          amount_aed: number
          created_at?: string
          due_date: string
          id?: string
          label: string
          lead_id?: string | null
          listing_id?: string | null
          milestone?: string | null
          paid?: boolean
        }
        Update: {
          amount_aed?: number
          created_at?: string
          due_date?: string
          id?: string
          label?: string
          lead_id?: string | null
          listing_id?: string | null
          milestone?: string | null
          paid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      uae_knowledge: {
        Row: {
          created_at: string
          fact: string
          id: string
          last_verified: string
          needs_verification: boolean
          source: string
          topic: string
        }
        Insert: {
          created_at?: string
          fact: string
          id?: string
          last_verified?: string
          needs_verification?: boolean
          source?: string
          topic: string
        }
        Update: {
          created_at?: string
          fact?: string
          id?: string
          last_verified?: string
          needs_verification?: boolean
          source?: string
          topic?: string
        }
        Relationships: []
      }
      viewings: {
        Row: {
          created_at: string
          followup_sent: boolean
          id: string
          kind: string
          lead_id: string | null
          listing_id: string | null
          reminder_sent: boolean
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          followup_sent?: boolean
          id?: string
          kind?: string
          lead_id?: string | null
          listing_id?: string | null
          reminder_sent?: boolean
          starts_at: string
          status?: string
        }
        Update: {
          created_at?: string
          followup_sent?: boolean
          id?: string
          kind?: string
          lead_id?: string | null
          listing_id?: string | null
          reminder_sent?: boolean
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      refresh_listing_checks: { Args: never; Returns: number }
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
