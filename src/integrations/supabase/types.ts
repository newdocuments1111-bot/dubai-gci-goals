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
          target_calls_month: number | null
          target_gci_month_aed: number | null
          target_viewings_month: number | null
          team_leader_id: string | null
          alert_push: boolean
          alert_whatsapp: boolean
          mobile: string
          in_rotation: boolean
          last_routed_at: string | null
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
          target_calls_month?: number | null
          target_gci_month_aed?: number | null
          target_viewings_month?: number | null
          team_leader_id?: string | null
          alert_push?: boolean
          alert_whatsapp?: boolean
          mobile?: string
          in_rotation?: boolean
          last_routed_at?: string | null
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
          target_calls_month?: number | null
          target_gci_month_aed?: number | null
          target_viewings_month?: number | null
          team_leader_id?: string | null
          alert_push?: boolean
          alert_whatsapp?: boolean
          mobile?: string
          in_rotation?: boolean
          last_routed_at?: string | null
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
          voice_replies: boolean
        }
        Insert: {
          agency_id?: string
          agency_name?: string
          fees?: Json
          id?: string
          rules?: Json
          updated_at?: string
          voice_replies?: boolean
        }
        Update: {
          agency_id?: string
          agency_name?: string
          fees?: Json
          id?: string
          rules?: Json
          updated_at?: string
          voice_replies?: boolean
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
      agent_alert_template: {
        Row: {
          agency_id: string
          detail: string | null
          language: string
          meta_template_id: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          detail?: string | null
          language?: string
          meta_template_id?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          detail?: string | null
          language?: string
          meta_template_id?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          pushed_at: string | null
          agency_id: string
          created_at: string
          id: string
          kind: string
          lead_id: string | null
          message: string
          read: boolean
        }
        Insert: {
          pushed_at?: string | null
          agency_id?: string
          created_at?: string
          id?: string
          kind: string
          lead_id?: string | null
          message: string
          read?: boolean
        }
        Update: {
          pushed_at?: string | null
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
          nurture_days: number
          bank_details: string
          company_trn: string
          default_commission_percent: number
          dld_admin_aed: number
          dld_fee_percent: number
          mortgage_reg_percent: number
          trustee_fee_high_aed: number
          trustee_fee_low_aed: number
          vat_percent: number
          pool_after_minutes: number
          pool_daily_limit: number
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
          nurture_days?: number
          bank_details?: string
          company_trn?: string
          default_commission_percent?: number
          dld_admin_aed?: number
          dld_fee_percent?: number
          mortgage_reg_percent?: number
          trustee_fee_high_aed?: number
          trustee_fee_low_aed?: number
          vat_percent?: number
          pool_after_minutes?: number
          pool_daily_limit?: number
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
          nurture_days?: number
          bank_details?: string
          company_trn?: string
          default_commission_percent?: number
          dld_admin_aed?: number
          dld_fee_percent?: number
          mortgage_reg_percent?: number
          trustee_fee_high_aed?: number
          trustee_fee_low_aed?: number
          vat_percent?: number
          pool_after_minutes?: number
          pool_daily_limit?: number
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
          voice_error: string | null
          voice_status: string | null
          voice_wa_message_id: string | null
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
          voice_error?: string | null
          voice_status?: string | null
          voice_wa_message_id?: string | null
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
          voice_error?: string | null
          voice_status?: string | null
          voice_wa_message_id?: string | null
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
      deal_compliance: {
        Row: {
          agency_id: string
          buyer_id_collected: boolean
          cash_aed: number
          company_papers_collected: boolean
          deal_id: string
          is_company: boolean
          notes: string
          payer_is_the_buyer: boolean
          payer_name: string
          politically_exposed: boolean
          rear_filed: boolean
          rear_filed_on: string | null
          rear_reference: string
          seller_id_collected: boolean
          source_of_funds: string
          updated_at: string
          updated_by: string | null
          virtual_asset: boolean
        }
        Insert: {
          agency_id: string
          buyer_id_collected?: boolean
          cash_aed?: number
          company_papers_collected?: boolean
          deal_id: string
          is_company?: boolean
          notes?: string
          payer_is_the_buyer?: boolean
          payer_name?: string
          politically_exposed?: boolean
          rear_filed?: boolean
          rear_filed_on?: string | null
          rear_reference?: string
          seller_id_collected?: boolean
          source_of_funds?: string
          updated_at?: string
          updated_by?: string | null
          virtual_asset?: boolean
        }
        Update: {
          agency_id?: string
          buyer_id_collected?: boolean
          cash_aed?: number
          company_papers_collected?: boolean
          deal_id?: string
          is_company?: boolean
          notes?: string
          payer_is_the_buyer?: boolean
          payer_name?: string
          politically_exposed?: boolean
          rear_filed?: boolean
          rear_filed_on?: string | null
          rear_reference?: string
          seller_id_collected?: boolean
          source_of_funds?: string
          updated_at?: string
          updated_by?: string | null
          virtual_asset?: boolean
        }
        Relationships: []
      }
      deal_invoices: {
        Row: {
          agency_id: string
          deal_id: string
          id: string
          issued_at: string
          issued_by: string | null
          number: string
          seq: number
          snapshot: Json
        }
        Insert: {
          agency_id: string
          deal_id: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          number: string
          seq: number
          snapshot: Json
        }
        Update: {
          agency_id?: string
          deal_id?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          number?: string
          seq?: number
          snapshot?: Json
        }
        Relationships: []
      }
      deal_payments: {
        Row: {
          agency_id: string
          amount_aed: number
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          kind: string
          note: string
          paid_on: string
        }
        Insert: {
          agency_id: string
          amount_aed: number
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          kind: string
          note?: string
          paid_on?: string
        }
        Update: {
          agency_id?: string
          amount_aed?: number
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          kind?: string
          note?: string
          paid_on?: string
        }
        Relationships: []
      }
      deal_steps: {
        Row: {
          agency_id: string
          deal_id: string
          done_at: string | null
          done_by: string | null
          due_at: string | null
          id: string
          key: string
          label: string
          note: string
          position: number
          skipped: boolean
          who: string
        }
        Insert: {
          agency_id: string
          deal_id: string
          done_at?: string | null
          done_by?: string | null
          due_at?: string | null
          id?: string
          key: string
          label: string
          note?: string
          position?: number
          skipped?: boolean
          who?: string
        }
        Update: {
          agency_id?: string
          deal_id?: string
          done_at?: string | null
          done_by?: string | null
          due_at?: string | null
          id?: string
          key?: string
          label?: string
          note?: string
          position?: number
          skipped?: boolean
          who?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          co_broker_name: string
          co_broker_percent: number
          loan_aed: number | null
          seller_name: string
          total_commission_percent: number | null
          track: string
          vat_percent: number
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
          co_broker_name?: string
          co_broker_percent?: number
          loan_aed?: number | null
          seller_name?: string
          total_commission_percent?: number | null
          track?: string
          vat_percent?: number
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
          co_broker_name?: string
          co_broker_percent?: number
          loan_aed?: number | null
          seller_name?: string
          total_commission_percent?: number | null
          track?: string
          vat_percent?: number
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
      dev_holds: {
        Row: {
          agency_id: string
          broker_agency: string
          broker_name: string
          broker_phone: string
          client_name: string
          client_phone: string
          created_at: string
          expires_at: string
          held_by: string | null
          id: string
          notes: string
          project_id: string
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          unit_id: string
        }
        Insert: {
          agency_id?: string
          broker_agency?: string
          broker_name?: string
          broker_phone?: string
          client_name: string
          client_phone?: string
          created_at?: string
          expires_at: string
          held_by?: string | null
          id?: string
          notes?: string
          project_id: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          unit_id: string
        }
        Update: {
          agency_id?: string
          broker_agency?: string
          broker_name?: string
          broker_phone?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          expires_at?: string
          held_by?: string | null
          id?: string
          notes?: string
          project_id?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          unit_id?: string
        }
        Relationships: []
      }
      dev_instalments: {
        Row: {
          agency_id: string
          amount_aed: number
          created_at: string
          due_date: string | null
          id: string
          label: string
          paid_amount: number | null
          paid_at: string | null
          paid_by: string | null
          position: number
          project_id: string
          sale_id: string
        }
        Insert: {
          agency_id?: string
          amount_aed: number
          created_at?: string
          due_date?: string | null
          id?: string
          label: string
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          position?: number
          project_id: string
          sale_id: string
        }
        Update: {
          agency_id?: string
          amount_aed?: number
          created_at?: string
          due_date?: string | null
          id?: string
          label?: string
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          position?: number
          project_id?: string
          sale_id?: string
        }
        Relationships: []
      }
      dev_projects: {
        Row: {
          agency_id: string
          community: string
          created_at: string
          created_by: string | null
          developer_name: string
          handover_date: string | null
          id: string
          name: string
          notes: string
          payment_plan: Json
          status: string
          updated_at: string
        }
        Insert: {
          agency_id?: string
          community?: string
          created_at?: string
          created_by?: string | null
          developer_name?: string
          handover_date?: string | null
          id?: string
          name: string
          notes?: string
          payment_plan?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          community?: string
          created_at?: string
          created_by?: string | null
          developer_name?: string
          handover_date?: string | null
          id?: string
          name?: string
          notes?: string
          payment_plan?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      dev_sales: {
        Row: {
          agency_id: string
          broker_agency: string
          broker_commission_percent: number
          broker_name: string
          broker_phone: string
          buyer_name: string
          buyer_phone: string
          created_at: string
          hold_id: string | null
          id: string
          lead_id: string | null
          project_id: string
          sale_date: string
          sale_price_aed: number
          sold_by: string | null
          unit_id: string
        }
        Insert: {
          agency_id?: string
          broker_agency?: string
          broker_commission_percent?: number
          broker_name?: string
          broker_phone?: string
          buyer_name: string
          buyer_phone?: string
          created_at?: string
          hold_id?: string | null
          id?: string
          lead_id?: string | null
          project_id: string
          sale_date?: string
          sale_price_aed: number
          sold_by?: string | null
          unit_id: string
        }
        Update: {
          agency_id?: string
          broker_agency?: string
          broker_commission_percent?: number
          broker_name?: string
          broker_phone?: string
          buyer_name?: string
          buyer_phone?: string
          created_at?: string
          hold_id?: string | null
          id?: string
          lead_id?: string | null
          project_id?: string
          sale_date?: string
          sale_price_aed?: number
          sold_by?: string | null
          unit_id?: string
        }
        Relationships: []
      }
      dev_units: {
        Row: {
          agency_id: string
          bedrooms: number
          created_at: string
          floor: string
          id: string
          price_aed: number
          project_id: string
          size_sqft: number
          status: string
          unit_number: string
          unit_type: string
          updated_at: string
          view: string
        }
        Insert: {
          agency_id?: string
          bedrooms?: number
          created_at?: string
          floor?: string
          id?: string
          price_aed?: number
          project_id: string
          size_sqft?: number
          status?: string
          unit_number: string
          unit_type?: string
          updated_at?: string
          view?: string
        }
        Update: {
          agency_id?: string
          bedrooms?: number
          created_at?: string
          floor?: string
          id?: string
          price_aed?: number
          project_id?: string
          size_sqft?: number
          status?: string
          unit_number?: string
          unit_type?: string
          updated_at?: string
          view?: string
        }
        Relationships: []
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
      hh_bookings: {
        Row: {
          agency_id: string
          channel_fee_aed: number
          check_in: string
          check_out: string
          cleaning_fee_aed: number
          created_at: string
          created_by: string | null
          external_uid: string | null
          guest_country: string
          guest_email: string
          guest_id_received: boolean
          guest_language: string
          guest_name: string
          guest_phone: string
          guests: number
          home_id: string
          id: string
          notes: string
          source: string
          status: string
          total_amount_aed: number
          updated_at: string
        }
        Insert: {
          agency_id?: string
          channel_fee_aed?: number
          check_in: string
          check_out: string
          cleaning_fee_aed?: number
          created_at?: string
          created_by?: string | null
          external_uid?: string | null
          guest_country?: string
          guest_email?: string
          guest_id_received?: boolean
          guest_language?: string
          guest_name?: string
          guest_phone?: string
          guests?: number
          home_id: string
          id?: string
          notes?: string
          source?: string
          status?: string
          total_amount_aed?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          channel_fee_aed?: number
          check_in?: string
          check_out?: string
          cleaning_fee_aed?: number
          created_at?: string
          created_by?: string | null
          external_uid?: string | null
          guest_country?: string
          guest_email?: string
          guest_id_received?: boolean
          guest_language?: string
          guest_name?: string
          guest_phone?: string
          guests?: number
          home_id?: string
          id?: string
          notes?: string
          source?: string
          status?: string
          total_amount_aed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hh_bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hh_bookings_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "hh_homes"
            referencedColumns: ["id"]
          },
        ]
      }
      hh_homes: {
        Row: {
          active: boolean
          agency_id: string
          bedrooms: number | null
          building: string
          check_in_instructions: string
          cleaning_fee_aed: number
          community: string
          created_at: string
          created_by: string | null
          id: string
          management_fee_percent: number
          name: string
          nightly_price_aed: number
          owner_id: string | null
          owner_name: string
          owner_phone: string
          permit_expires_on: string | null
          permit_number: string
          sleeps: number | null
          updated_at: string
          wifi: string
        }
        Insert: {
          active?: boolean
          agency_id?: string
          bedrooms?: number | null
          building?: string
          check_in_instructions?: string
          cleaning_fee_aed?: number
          community?: string
          created_at?: string
          created_by?: string | null
          id?: string
          management_fee_percent?: number
          name: string
          nightly_price_aed?: number
          owner_id?: string | null
          owner_name?: string
          owner_phone?: string
          permit_expires_on?: string | null
          permit_number?: string
          sleeps?: number | null
          updated_at?: string
          wifi?: string
        }
        Update: {
          active?: boolean
          agency_id?: string
          bedrooms?: number | null
          building?: string
          check_in_instructions?: string
          cleaning_fee_aed?: number
          community?: string
          created_at?: string
          created_by?: string | null
          id?: string
          management_fee_percent?: number
          name?: string
          nightly_price_aed?: number
          owner_id?: string | null
          owner_name?: string
          owner_phone?: string
          permit_expires_on?: string | null
          permit_number?: string
          sleeps?: number | null
          updated_at?: string
          wifi?: string
        }
        Relationships: [
          {
            foreignKeyName: "hh_homes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hh_homes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      hh_tasks: {
        Row: {
          agency_id: string
          assigned_to: string
          booking_id: string | null
          created_at: string
          created_by: string | null
          due_at: string
          home_id: string
          id: string
          kind: string
          note: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_id?: string
          assigned_to?: string
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at: string
          home_id: string
          id?: string
          kind?: string
          note?: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assigned_to?: string
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          home_id?: string
          id?: string
          kind?: string
          note?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hh_tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hh_tasks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "hh_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hh_tasks_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "hh_homes"
            referencedColumns: ["id"]
          },
        ]
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
      lead_calls: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          lead_id: string
          note: string
          outcome: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          lead_id: string
          note?: string
          outcome: string
          user_id?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          note?: string
          outcome?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_claims: {
        Row: {
          agency_id: string
          agent_id: string
          claimed_at: string
          id: string
          lead_id: string
        }
        Insert: {
          agency_id: string
          agent_id: string
          claimed_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          agency_id?: string
          agent_id?: string
          claimed_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: []
      }
      lead_intake: {
        Row: {
          agency_id: string
          created_at: string
          enabled: boolean
          last_used_at: string | null
          token: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          enabled?: boolean
          last_used_at?: string | null
          token?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          enabled?: boolean
          last_used_at?: string | null
          token?: string
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
          do_not_call: boolean
          reminded_at: string | null
          assigned_at: string | null
          email: string
          enquiry: string
          intake: string
          pooled_at: string | null
          portal_ref: string | null
          routed: boolean
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
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
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
          do_not_call?: boolean
          reminded_at?: string | null
          assigned_at?: string | null
          email?: string
          enquiry?: string
          intake?: string
          pooled_at?: string | null
          portal_ref?: string | null
          routed?: boolean
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
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
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
          do_not_call?: boolean
          reminded_at?: string | null
          assigned_at?: string | null
          email?: string
          enquiry?: string
          intake?: string
          pooled_at?: string | null
          portal_ref?: string | null
          routed?: boolean
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
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
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
          owner_id: string | null
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
          permit_expires_on: string | null
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
          owner_id?: string | null
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
          permit_expires_on?: string | null
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
          owner_id?: string | null
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
          permit_expires_on?: string | null
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
      meta_ad_insights: {
        Row: {
          ad_account_id: string
          ad_id: string
          ad_name: string
          adset_id: string
          adset_name: string
          agency_id: string
          campaign_id: string
          campaign_name: string
          clicks: number
          currency: string
          date: string
          id: number
          impressions: number
          meta_leads: number
          spend: number
          synced_at: string
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          ad_name?: string
          adset_id?: string
          adset_name?: string
          agency_id: string
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          currency?: string
          date: string
          id?: never
          impressions?: number
          meta_leads?: number
          spend?: number
          synced_at?: string
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          ad_name?: string
          adset_id?: string
          adset_name?: string
          agency_id?: string
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          currency?: string
          date?: string
          id?: never
          impressions?: number
          meta_leads?: number
          spend?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_insights_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_connections: {
        Row: {
          account_name: string
          ad_account_id: string
          agency_id: string
          connected_at: string
          connected_by: string | null
          currency: string
          last_sync_at: string | null
          last_sync_message: string
          last_sync_ok: boolean | null
          last_sync_rows: number
          sync_started_at: string | null
        }
        Insert: {
          account_name?: string
          ad_account_id: string
          agency_id: string
          connected_at?: string
          connected_by?: string | null
          currency?: string
          last_sync_at?: string | null
          last_sync_message?: string
          last_sync_ok?: boolean | null
          last_sync_rows?: number
          sync_started_at?: string | null
        }
        Update: {
          account_name?: string
          ad_account_id?: string
          agency_id?: string
          connected_at?: string
          connected_by?: string | null
          currency?: string
          last_sync_at?: string | null
          last_sync_message?: string
          last_sync_ok?: boolean | null
          last_sync_rows?: number
          sync_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_connections_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_tokens: {
        Row: {
          access_token: string
          agency_id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          agency_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          agency_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_tokens_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_lead_hits: {
        Row: {
          agency_id: string
          created_at: string
          duplicate: boolean
          id: string
          lead_id: string
          meta_ad_id: string | null
          meta_adset_id: string | null
          meta_campaign_id: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          duplicate?: boolean
          id?: string
          lead_id: string
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          duplicate?: boolean
          id?: string
          lead_id?: string
          meta_ad_id?: string | null
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_hits_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_lead_hits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          annual_rent_aed: number | null
          asking_price_aed: number | null
          intent: string
          next_action_on: string | null
          notes: string
          stage: string
          tenant_name: string
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
          annual_rent_aed?: number | null
          asking_price_aed?: number | null
          intent?: string
          next_action_on?: string | null
          notes?: string
          stage?: string
          tenant_name?: string
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
          annual_rent_aed?: number | null
          asking_price_aed?: number | null
          intent?: string
          next_action_on?: string | null
          notes?: string
          stage?: string
          tenant_name?: string
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
      pm_cheques: {
        Row: {
          agency_id: string
          amount_aed: number
          bank_date: string | null
          cleared_on: string | null
          created_at: string
          due_date: string
          id: string
          lease_id: string
          note: string
          seq: number
          status: string
          updated_at: string
        }
        Insert: {
          agency_id?: string
          amount_aed: number
          bank_date?: string | null
          cleared_on?: string | null
          created_at?: string
          due_date: string
          id?: string
          lease_id: string
          note?: string
          seq: number
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          amount_aed?: number
          bank_date?: string | null
          cleared_on?: string | null
          created_at?: string
          due_date?: string
          id?: string
          lease_id?: string
          note?: string
          seq?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_cheques_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_cheques_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "pm_leases"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_leases: {
        Row: {
          agency_id: string
          annual_rent_aed: number
          cheque_count: number
          created_at: string
          created_by: string | null
          deposit_aed: number
          ejari_number: string
          end_date: string
          id: string
          lead_id: string | null
          proposed_rent: string
          renewal_note: string
          start_date: string
          status: string
          tenant_email: string
          tenant_name: string
          tenant_phone: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          agency_id?: string
          annual_rent_aed: number
          cheque_count?: number
          created_at?: string
          created_by?: string | null
          deposit_aed?: number
          ejari_number?: string
          end_date: string
          id?: string
          lead_id?: string | null
          proposed_rent?: string
          renewal_note?: string
          start_date: string
          status?: string
          tenant_email?: string
          tenant_name?: string
          tenant_phone?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          annual_rent_aed?: number
          cheque_count?: number
          created_at?: string
          created_by?: string | null
          deposit_aed?: number
          ejari_number?: string
          end_date?: string
          id?: string
          lead_id?: string | null
          proposed_rent?: string
          renewal_note?: string
          start_date?: string
          status?: string
          tenant_email?: string
          tenant_name?: string
          tenant_phone?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_leases_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_leases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "pm_units"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_tickets: {
        Row: {
          agency_id: string
          closed_on: string | null
          contractor_name: string
          contractor_phone: string
          cost_aed: number | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          opened_on: string
          priority: string
          reported_by: string
          status: string
          title: string
          unit_id: string
          updated_at: string
          who_pays: string
        }
        Insert: {
          agency_id?: string
          closed_on?: string | null
          contractor_name?: string
          contractor_phone?: string
          cost_aed?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          opened_on?: string
          priority?: string
          reported_by?: string
          status?: string
          title: string
          unit_id: string
          updated_at?: string
          who_pays?: string
        }
        Update: {
          agency_id?: string
          closed_on?: string | null
          contractor_name?: string
          contractor_phone?: string
          cost_aed?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          opened_on?: string
          priority?: string
          reported_by?: string
          status?: string
          title?: string
          unit_id?: string
          updated_at?: string
          who_pays?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_tickets_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tickets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "pm_units"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_units: {
        Row: {
          agency_id: string
          bedrooms: number | null
          building: string
          community: string
          created_at: string
          created_by: string | null
          id: string
          management_fee_percent: number
          notes: string
          owner_id: string
          size_sqft: number | null
          status: string
          unit_number: string
          unit_type: string
          updated_at: string
        }
        Insert: {
          agency_id?: string
          bedrooms?: number | null
          building?: string
          community?: string
          created_at?: string
          created_by?: string | null
          id?: string
          management_fee_percent?: number
          notes?: string
          owner_id: string
          size_sqft?: number | null
          status?: string
          unit_number?: string
          unit_type?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          bedrooms?: number | null
          building?: string
          community?: string
          created_at?: string
          created_by?: string | null
          id?: string
          management_fee_percent?: number
          notes?: string
          owner_id?: string
          size_sqft?: number | null
          status?: string
          unit_number?: string
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_units_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_units_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      push_keys: {
        Row: {
          id: number
          subject: string
          vapid_private: Json
          vapid_public: string
        }
        Insert: {
          id?: number
          subject?: string
          vapid_private: Json
          vapid_public: string
        }
        Update: {
          id?: number
          subject?: string
          vapid_private?: Json
          vapid_public?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_ok_at: string | null
          p256dh: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_ok_at?: string | null
          p256dh: string
          user_agent?: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_ok_at?: string | null
          p256dh?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: []
      }
      rent_cheques: {
        Row: {
          agency_id: string
          amount_aed: number
          cheque_no: string
          created_at: string
          due_date: string
          id: string
          note: string
          owner_id: string
          reminded_at: string | null
          status: string
        }
        Insert: {
          agency_id?: string
          amount_aed: number
          cheque_no?: string
          created_at?: string
          due_date: string
          id?: string
          note?: string
          owner_id: string
          reminded_at?: string | null
          status?: string
        }
        Update: {
          agency_id?: string
          amount_aed?: number
          cheque_no?: string
          created_at?: string
          due_date?: string
          id?: string
          note?: string
          owner_id?: string
          reminded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      routing_rules: {
        Row: {
          agency_id: string
          agent_id: string
          created_at: string
          id: string
          kind: string
          position: number
          value: string
        }
        Insert: {
          agency_id?: string
          agent_id: string
          created_at?: string
          id?: string
          kind: string
          position?: number
          value: string
        }
        Update: {
          agency_id?: string
          agent_id?: string
          created_at?: string
          id?: string
          kind?: string
          position?: number
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          agency_id: string
          at: string
          detail: string
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          agency_id: string
          at?: string
          detail?: string
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          agency_id?: string
          at?: string
          detail?: string
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          agency_id: string
          audience: string
          created_at: string
          created_by: string | null
          id: string
          lead_count: number
          name: string
          skipped_count: number
          status: string
          steps: Json
        }
        Insert: {
          agency_id: string
          audience?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_count?: number
          name: string
          skipped_count?: number
          status?: string
          steps?: Json
        }
        Update: {
          agency_id?: string
          audience?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_count?: number
          name?: string
          skipped_count?: number
          status?: string
          steps?: Json
        }
        Relationships: []
      }
      saved_lists: {
        Row: {
          agency_id: string
          created_at: string
          filters: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          agency_id?: string
          created_at?: string
          filters: Json
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          user_id?: string
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
          campaign_id: string | null
          campaign_step: number | null
          category: string
          chat_message_id: string | null
          claimed_until: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          lead_id: string
          meta_limit_retries: number
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
          campaign_id?: string | null
          campaign_step?: number | null
          category?: string
          chat_message_id?: string | null
          claimed_until?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          lead_id: string
          meta_limit_retries?: number
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
          campaign_id?: string | null
          campaign_step?: number | null
          category?: string
          chat_message_id?: string | null
          claimed_until?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          lead_id?: string
          meta_limit_retries?: number
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
      can_access_deal: { Args: { _deal: string }; Returns: boolean }
      can_edit_deal: { Args: { _deal: string }; Returns: boolean }
      issue_deal_invoice: { Args: { _deal: string; _snapshot: Json }; Returns: string }
      dev_cancel_sale: { Args: { _sale: string }; Returns: undefined }
      dev_hold_unit: {
        Args: {
          _broker_agency: string
          _broker_name: string
          _broker_phone: string
          _client_name: string
          _client_phone: string
          _hours: number
          _notes: string
          _unit: string
        }
        Returns: string
      }
      dev_release_expired_holds: { Args: never; Returns: number }
      dev_release_hold: { Args: { _hold: string }; Returns: undefined }
      dev_sell_unit: {
        Args: {
          _broker_agency: string
          _broker_commission_percent: number
          _broker_name: string
          _broker_phone: string
          _buyer_name: string
          _buyer_phone: string
          _hold: string | null
          _instalments: Json
          _lead: string | null
          _sale_date: string
          _sale_price_aed: number
          _unit: string
        }
        Returns: string
      }
      dev_unit_status: { Args: { _unit: string }; Returns: string }
      claim_alert_deliveries: {
        Args: { _limit: number }
        Returns: {
          agency_id: string
          alert_id: string
          kind: string
          lead_id: string | null
          message: string
          recipients: string[]
        }[]
      }
      push_public_key: { Args: never; Returns: string }
      set_my_alerts: { Args: { _mobile: string; _push: boolean; _whatsapp: boolean }; Returns: undefined }
      claim_pool_lead: { Args: { _lead: string }; Returns: string }
      intake_lead: { Args: { _lead: Json; _token: string }; Returns: Json }
      pool_leads: {
        Args: never
        Returns: {
          area: string
          budget: string
          created_at: string
          enquiry: string
          id: string
          language: string
          name: string
          pooled_at: string | null
          portal_ref: string | null
          source: string
        }[]
      }
      return_untouched_leads: { Args: never; Returns: number }
      rotate_intake_key: { Args: never; Returns: string }
      set_rotation: { Args: { _on: boolean; _user: string }; Returns: undefined }
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
          campaign_id: string | null
          campaign_step: number | null
          category: string
          chat_message_id: string | null
          claimed_until: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          lead_id: string
          meta_limit_retries: number
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
