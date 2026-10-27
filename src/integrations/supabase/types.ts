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
      agencies: {
        Row: {
          created_at: string
          goal_setting_mode: string
          id: string
          monthly_fee_aed: number
          name: string
          plan_logins: number
          status: string
        }
        Insert: {
          created_at?: string
          goal_setting_mode?: string
          id?: string
          monthly_fee_aed?: number
          name: string
          plan_logins?: number
          status?: string
        }
        Update: {
          created_at?: string
          goal_setting_mode?: string
          id?: string
          monthly_fee_aed?: number
          name?: string
          plan_logins?: number
          status?: string
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          agency_id: string
          annual_gci_goal_aed: number | null
          created_at: string
          display_name: string
          email: string
          id: string
          role: string
          split_percent: number
          user_id: string
        }
        Insert: {
          agency_id: string
          annual_gci_goal_aed?: number | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role: string
          split_percent?: number
          user_id: string
        }
        Update: {
          agency_id?: string
          annual_gci_goal_aed?: number | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role?: string
          split_percent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reply_settings: {
        Row: {
          agency_id: string
          agency_name: string
          fees: Json
          id: string
          rules: Json
          updated_at: string
        }
        Insert: {
          agency_id?: string
          agency_name?: string
          fees?: Json
          id?: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          agency_id?: string
          agency_name?: string
          fees?: Json
          id?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reply_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          kind: string
          lead_id: string | null
          message: string
          read: boolean
        }
        Insert: {
          agency_id?: string
          created_at?: string
          id?: string
          kind: string
          lead_id?: string | null
          message: string
          read?: boolean
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          message?: string
          read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "alerts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
          agency_id: string
          agency_name: string
          agent_name: string
          compliance_email: string
          holidays: string[]
          id: string
          minutes_per_ai_reply: number
          missed_lead_minutes: number
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
          agency_id?: string
          agency_name?: string
          agent_name?: string
          compliance_email?: string
          holidays?: string[]
          id?: string
          minutes_per_ai_reply?: number
          missed_lead_minutes?: number
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
          agency_id?: string
          agency_name?: string
          agent_name?: string
          compliance_email?: string
          holidays?: string[]
          id?: string
          minutes_per_ai_reply?: number
          missed_lead_minutes?: number
          mortgage_partner?: string
          rera_brn?: string
          retention_years?: number
          updated_at?: string
          viewing_minutes?: number
          work_end?: string
          work_start?: string
          working_days?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          agency_id: string
          author_id: string | null
          channel: string
          content: string
          created_at: string
          id: string
          in_reply_to: string | null
          language: string
          lead_id: string
          media_kind: string | null
          media_path: string | null
          original_content: string | null
          role: string
          sent: boolean
          wa_delivered_at: string | null
          wa_error: string | null
          wa_failed_at: string | null
          wa_message_id: string | null
          wa_read_at: string | null
          wa_sent_at: string | null
          wa_status: string | null
        }
        Insert: {
          agency_id?: string
          author_id?: string | null
          channel?: string
          content: string
          created_at?: string
          id?: string
          in_reply_to?: string | null
          language?: string
          lead_id: string
          media_kind?: string | null
          media_path?: string | null
          original_content?: string | null
          role: string
          sent?: boolean
          wa_delivered_at?: string | null
          wa_error?: string | null
          wa_failed_at?: string | null
          wa_message_id?: string | null
          wa_read_at?: string | null
          wa_sent_at?: string | null
          wa_status?: string | null
        }
        Update: {
          agency_id?: string
          author_id?: string | null
          channel?: string
          content?: string
          created_at?: string
          id?: string
          in_reply_to?: string | null
          language?: string
          lead_id?: string
          media_kind?: string | null
          media_path?: string | null
          original_content?: string | null
          role?: string
          sent?: boolean
          wa_delivered_at?: string | null
          wa_error?: string | null
          wa_failed_at?: string | null
          wa_message_id?: string | null
          wa_read_at?: string | null
          wa_sent_at?: string | null
          wa_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
          agency_id: string
          agreed_to: string
          created_at: string
          how: string
          id: string
          lead_id: string
        }
        Insert: {
          agency_id?: string
          agreed_to: string
          created_at?: string
          how?: string
          id?: string
          lead_id: string
        }
        Update: {
          agency_id?: string
          agreed_to?: string
          created_at?: string
          how?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_log_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          agency_id: string
          agent_id: string
          ai_handled: boolean
          closed_at: string | null
          commission_percent: number
          created_at: string
          deal_type: string
          id: string
          lead_id: string | null
          listing_id: string | null
          price_aed: number
          status: string
          updated_at: string
        }
        Insert: {
          agency_id?: string
          agent_id?: string
          ai_handled?: boolean
          closed_at?: string | null
          commission_percent: number
          created_at?: string
          deal_type: string
          id?: string
          lead_id?: string | null
          listing_id?: string | null
          price_aed: number
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          agent_id?: string
          ai_handled?: boolean
          closed_at?: string | null
          commission_percent?: number
          created_at?: string
          deal_type?: string
          id?: string
          lead_id?: string | null
          listing_id?: string | null
          price_aed?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_usage: {
        Row: {
          day: string
          messages: number
          visitor_id: string
        }
        Insert: {
          day?: string
          messages?: number
          visitor_id: string
        }
        Update: {
          day?: string
          messages?: number
          visitor_id?: string
        }
        Relationships: []
      }
      document_log: {
        Row: {
          action: string
          agency_id: string
          client_name: string
          created_at: string
          id: string
          lead_id: string | null
          path: string
        }
        Insert: {
          action: string
          agency_id?: string
          client_name: string
          created_at?: string
          id?: string
          lead_id?: string | null
          path: string
        }
        Update: {
          action?: string
          agency_id?: string
          client_name?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_log_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          agency_id: string
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
          agency_id?: string
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
          agency_id?: string
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
            foreignKeyName: "follow_ups_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
          agency_id: string
          ai_paused: boolean
          area: string
          assigned_agent_id: string | null
          budget: string
          created_at: string
          flagged: boolean
          hubspot_id: string | null
          id: string
          last_message_at: string | null
          learned: Json
          name: string
          next_step: string
          opted_in: boolean
          phone: string
          score: string
          source: string
          stopped: boolean
          timezone: string
          timing: string
          type: string
          whatsapp_last_inbound_at: string | null
        }
        Insert: {
          agency_id?: string
          ai_paused?: boolean
          area?: string
          assigned_agent_id?: string | null
          budget?: string
          created_at?: string
          flagged?: boolean
          hubspot_id?: string | null
          id?: string
          last_message_at?: string | null
          learned?: Json
          name?: string
          next_step?: string
          opted_in?: boolean
          phone?: string
          score?: string
          source?: string
          stopped?: boolean
          timezone?: string
          timing?: string
          type?: string
          whatsapp_last_inbound_at?: string | null
        }
        Update: {
          agency_id?: string
          ai_paused?: boolean
          area?: string
          assigned_agent_id?: string | null
          budget?: string
          created_at?: string
          flagged?: boolean
          hubspot_id?: string | null
          id?: string
          last_message_at?: string | null
          learned?: Json
          name?: string
          next_step?: string
          opted_in?: boolean
          phone?: string
          score?: string
          source?: string
          stopped?: boolean
          timezone?: string
          timing?: string
          type?: string
          whatsapp_last_inbound_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          agency_id: string
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
          agency_id?: string
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
          agency_id?: string
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
        Relationships: [
          {
            foreignKeyName: "listings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
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
          agency_id: string
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
          agency_id?: string
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
          agency_id?: string
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
        Relationships: [
          {
            foreignKeyName: "owners_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          agency_id: string
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
          agency_id?: string
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
          agency_id?: string
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
            foreignKeyName: "payment_schedules_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
      usage_events: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          type: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          type: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      viewings: {
        Row: {
          agency_id: string
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
          agency_id?: string
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
          agency_id?: string
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
            foreignKeyName: "viewings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
      whatsapp_settings: {
        Row: {
          agency_id: string
          checked_at: string | null
          display_number: string
          id: string
          last_webhook_at: string | null
          phone_number_id: string
          status: string
          status_detail: string
          test_mode: boolean
          test_recipients: string[]
          updated_at: string
          waba_id: string
        }
        Insert: {
          agency_id: string
          checked_at?: string | null
          display_number?: string
          id?: string
          last_webhook_at?: string | null
          phone_number_id?: string
          status?: string
          status_detail?: string
          test_mode?: boolean
          test_recipients?: string[]
          updated_at?: string
          waba_id?: string
        }
        Update: {
          agency_id?: string
          checked_at?: string | null
          display_number?: string
          id?: string
          last_webhook_at?: string | null
          phone_number_id?: string
          status?: string
          status_detail?: string
          test_mode?: boolean
          test_recipients?: string[]
          updated_at?: string
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          agency_id: string | null
          attempts: number
          claimed_until: string | null
          delivery_key: string
          id: string
          kind: string
          next_attempt_at: string
          outcome: string
          payload: Json
          phone_number_id: string
          processed_at: string | null
          processing_error: string | null
          received_at: string
          wa_id: string
        }
        Insert: {
          agency_id?: string | null
          attempts?: number
          claimed_until?: string | null
          delivery_key: string
          id?: string
          kind: string
          next_attempt_at?: string
          outcome?: string
          payload: Json
          phone_number_id?: string
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          wa_id?: string
        }
        Update: {
          agency_id?: string | null
          attempts?: number
          claimed_until?: string | null
          delivery_key?: string
          id?: string
          kind?: string
          next_attempt_at?: string
          outcome?: string
          payload?: Json
          phone_number_id?: string
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agency_booked_times: { Args: never; Returns: string[] }
      apply_whatsapp_status: {
        Args: {
          p_at: string
          p_error: string
          p_status: string
          p_wa_id: string
        }
        Returns: boolean
      }
      approve_chat_follow_up: {
        Args: { p_draft: string; p_id: string }
        Returns: undefined
      }
      can_access_lead: { Args: { _lead: string }; Returns: boolean }
      can_access_lead_documents: { Args: { _lead: string }; Returns: boolean }
      check_missed_leads: { Args: never; Returns: number }
      claim_whatsapp_events: {
        Args: { p_extra: number; p_ids: string[] }
        Returns: {
          agency_id: string | null
          attempts: number
          claimed_until: string | null
          delivery_key: string
          id: string
          kind: string
          next_attempt_at: string
          outcome: string
          payload: Json
          phone_number_id: string
          processed_at: string | null
          processing_error: string | null
          received_at: string
          wa_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_webhook_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_my_agency: {
        Args: { _display_name: string; _name: string }
        Returns: string
      }
      draft_old_lead_revivals: { Args: never; Returns: number }
      draft_scheduled_reminders: { Args: never; Returns: undefined }
      hq_agency_overview: {
        Args: never
        Returns: {
          agency_id: string
          agency_name: string
          ai_replies: number
          ai_replies_month: number
          closed_gci_aed: number
          deals: number
          flagged_chats: number
          leads: number
          logins_used: number
          missed_leads: number
          monthly_fee_aed: number
          plan_logins: number
          status: string
          viewings: number
          whatsapp_month: number
        }[]
      }
      is_agency_member: { Args: { _agency: string }; Returns: boolean }
      is_agency_owner: { Args: { _agency: string }; Returns: boolean }
      is_hq_admin: { Args: never; Returns: boolean }
      my_agency_id: { Args: never; Returns: string }
      refresh_listing_checks: { Args: never; Returns: number }
      reserve_demo_message: { Args: { p_visitor: string }; Returns: number }
      set_goal_setting_mode: { Args: { _mode: string }; Returns: undefined }
      set_my_goal: { Args: { _goal: number }; Returns: undefined }
      storage_path_access: {
        Args: { _bucket: string; _name: string }
        Returns: boolean
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
