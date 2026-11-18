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
          annual_gci_goal_aed: number
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
          annual_gci_goal_aed?: number
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
          annual_gci_goal_aed?: number
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
          translation_en: string | null
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
          translation_en?: string | null
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
          translation_en?: string | null
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
          chat_message_id: string | null
          created_at: string
          draft: string
          id: string
          kind: string
          lead_id: string | null
          owner_id: string | null
          send_after: string | null
          sent_at: string | null
          status: string
          viewing_id: string | null
        }
        Insert: {
          agency_id?: string
          chat_message_id?: string | null
          created_at?: string
          draft: string
          id?: string
          kind?: string
          lead_id?: string | null
          owner_id?: string | null
          send_after?: string | null
          sent_at?: string | null
          status?: string
          viewing_id?: string | null
        }
        Update: {
          agency_id?: string
          chat_message_id?: string | null
          created_at?: string
          draft?: string
          id?: string
          kind?: string
          lead_id?: string | null
          owner_id?: string | null
          send_after?: string | null
          sent_at?: string | null
          status?: string
          viewing_id?: string | null
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
            foreignKeyName: "follow_ups_chat_message_id_fkey"
            columns: ["chat_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_viewing_id_fkey"
            columns: ["viewing_id"]
            isOneToOne: false
            referencedRelation: "viewings"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          agency_id: string
          buyer_type: string | null
          created_at: string
          creative_type: string | null
          daily_budget_aed: number | null
          ended_at: string | null
          id: string
          is_sample: boolean
          name: string
          notes: string | null
          offer: string | null
          platform: string
          spend_to_date_aed: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id?: string
          buyer_type?: string | null
          created_at?: string
          creative_type?: string | null
          daily_budget_aed?: number | null
          ended_at?: string | null
          id?: string
          is_sample?: boolean
          name: string
          notes?: string | null
          offer?: string | null
          platform?: string
          spend_to_date_aed?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          buyer_type?: string | null
          created_at?: string
          creative_type?: string | null
          daily_budget_aed?: number | null
          ended_at?: string | null
          id?: string
          is_sample?: boolean
          name?: string
          notes?: string | null
          offer?: string | null
          platform?: string
          spend_to_date_aed?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_events: {
        Row: {
          agency_id: string
          at: string
          from_outcome: string | null
          from_stage: number | null
          id: number
          lead_id: string
          note: string | null
          to_outcome: string | null
          to_stage: number | null
        }
        Insert: {
          agency_id: string
          at?: string
          from_outcome?: string | null
          from_stage?: number | null
          id?: number
          lead_id: string
          note?: string | null
          to_outcome?: string | null
          to_stage?: number | null
        }
        Update: {
          agency_id?: string
          at?: string
          from_outcome?: string | null
          from_stage?: number | null
          id?: number
          lead_id?: string
          note?: string | null
          to_outcome?: string | null
          to_stage?: number | null
        }
        Relationships: []
      }
      lead_stages: {
        Row: {
          checklist: Json
          name: string
          next_action: string | null
          next_action_offset: string | null
          stage: number
          template: string | null
          track: string
          who: string
        }
        Insert: {
          checklist?: Json
          name: string
          next_action?: string | null
          next_action_offset?: string | null
          stage: number
          template?: string | null
          track: string
          who: string
        }
        Update: {
          checklist?: Json
          name?: string
          next_action?: string | null
          next_action_offset?: string | null
          stage?: number
          template?: string | null
          track?: string
          who?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          ad_campaign_id: string | null
          checklist_done: Json
          first_reply_at: string | null
          lost_reason: string | null
          max_stage: number
          next_action: string | null
          next_action_at: string | null
          outcome: string
          source_detail: string | null
          stage: number
          stage_entered_at: string
          stage_name: string | null
          track: string
          who: string | null
          agency_id: string
          ai_paused: boolean
          area: string
          assigned_agent_id: string | null
          budget: string
          created_at: string
          flagged: boolean
          hubspot_id: string | null
          id: string
          language: string
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
          ad_campaign_id?: string | null
          checklist_done?: Json
          first_reply_at?: string | null
          lost_reason?: string | null
          max_stage?: number
          next_action?: string | null
          next_action_at?: string | null
          outcome?: string
          source_detail?: string | null
          stage?: number
          stage_entered_at?: string
          stage_name?: string | null
          track?: string
          who?: string | null
          agency_id?: string
          ai_paused?: boolean
          area?: string
          assigned_agent_id?: string | null
          budget?: string
          created_at?: string
          flagged?: boolean
          hubspot_id?: string | null
          id?: string
          language?: string
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
          ad_campaign_id?: string | null
          checklist_done?: Json
          first_reply_at?: string | null
          lost_reason?: string | null
          max_stage?: number
          next_action?: string | null
          next_action_at?: string | null
          outcome?: string
          source_detail?: string | null
          stage?: number
          stage_entered_at?: string
          stage_name?: string | null
          track?: string
          who?: string | null
          agency_id?: string
          ai_paused?: boolean
          area?: string
          assigned_agent_id?: string | null
          budget?: string
          created_at?: string
          flagged?: boolean
          hubspot_id?: string | null
          id?: string
          language?: string
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
      message_templates: {
        Row: {
          agency_id: string
          body: string
          category: string
          created_at: string
          created_by: string | null
          examples: Json
          id: string
          label: string
          language: string
          meta_body: string
          meta_status: string
          meta_template_id: string | null
          name: string
          rejection_reason: string | null
          status_checked_at: string | null
          submitted_at: string | null
          updated_at: string
          variables: string[]
        }
        Insert: {
          agency_id?: string
          body: string
          category: string
          created_at?: string
          created_by?: string | null
          examples?: Json
          id?: string
          label: string
          language?: string
          meta_body?: string
          meta_status?: string
          meta_template_id?: string | null
          name: string
          rejection_reason?: string | null
          status_checked_at?: string | null
          submitted_at?: string | null
          updated_at?: string
          variables?: string[]
        }
        Update: {
          agency_id?: string
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          examples?: Json
          id?: string
          label?: string
          language?: string
          meta_body?: string
          meta_status?: string
          meta_template_id?: string | null
          name?: string
          rejection_reason?: string | null
          status_checked_at?: string | null
          submitted_at?: string | null
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
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
          done_at: string | null
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
          done_at?: string | null
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
          done_at?: string | null
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
      weekly_reports: {
        Row: {
          agency_id: string
          generated_at: string
          id: string
          report: Json
          week_start: string
        }
        Insert: {
          agency_id: string
          generated_at?: string
          id?: string
          report: Json
          week_start: string
        }
        Update: {
          agency_id?: string
          generated_at?: string
          id?: string
          report?: Json
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_outbox: {
        Row: {
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          attempts: number
          block_reason: string | null
          category: string
          chat_message_id: string | null
          claimed_until: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          lead_id: string
          preview: string
          purpose: string
          send_after: string
          sent_at: string | null
          status: string
          template_id: string | null
          template_name: string
          updated_at: string
          variables: Json
          wa_message_id: string | null
        }
        Insert: {
          agency_id: string
          approved_at?: string | null
          approved_by?: string | null
          attempts?: number
          block_reason?: string | null
          category?: string
          chat_message_id?: string | null
          claimed_until?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          lead_id: string
          preview?: string
          purpose?: string
          send_after?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          template_name?: string
          updated_at?: string
          variables?: Json
          wa_message_id?: string | null
        }
        Update: {
          agency_id?: string
          approved_at?: string | null
          approved_by?: string | null
          attempts?: number
          block_reason?: string | null
          category?: string
          chat_message_id?: string | null
          claimed_until?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          lead_id?: string
          preview?: string
          purpose?: string
          send_after?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          template_name?: string
          updated_at?: string
          variables?: Json
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_outbox_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_chat_message_id_fkey"
            columns: ["chat_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
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
          marketing_gap_days: number
          phone_number_id: string
          send_mode: string
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
          marketing_gap_days?: number
          phone_number_id?: string
          send_mode?: string
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
          marketing_gap_days?: number
          phone_number_id?: string
          send_mode?: string
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
      lead_report: {
        Row: {
          agency_id: string | null
          avg_first_reply_minutes: number | null
          cost_per_attended_viewing: number | null
          leads: number | null
          leads_out_of_hours: number | null
          overdue: number | null
          qualified: number | null
          replied: number | null
          replied_pct: number | null
          source: string | null
          source_type: string | null
          spend: number | null
          viewings_attended: number | null
          viewings_booked: number | null
          won: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      lead_advance: { Args: { p_lead: string; p_stage: number }; Returns: undefined }
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
      claim_viewing_followup: {
        Args: { p_draft: string; p_id: string }
        Returns: string
      }
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
      claim_whatsapp_outbox: {
        Args: { p_ids: string[]; p_limit: number }
        Returns: {
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          attempts: number
          block_reason: string | null
          category: string
          chat_message_id: string | null
          claimed_until: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          lead_id: string
          preview: string
          purpose: string
          send_after: string
          sent_at: string | null
          status: string
          template_id: string | null
          template_name: string
          updated_at: string
          variables: Json
          wa_message_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      client_reply_text: {
        Args: { p_key: string; p_lang: string; p_latin?: boolean }
        Returns: string
      }
      create_my_agency: {
        Args: { _display_name: string; _name: string }
        Returns: string
      }
      draft_old_lead_revivals: { Args: never; Returns: number }
      draft_scheduled_reminders: { Args: never; Returns: undefined }
      draft_second_viewing_followups: { Args: never; Returns: number }
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
      weekly_report_source: {
        Args: { p_agency: string; p_as_of?: string }
        Returns: Json
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
