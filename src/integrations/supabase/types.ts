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
