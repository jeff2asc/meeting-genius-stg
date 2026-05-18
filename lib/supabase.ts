import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js"

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole =
  | "master"
  | "property_manager"
  | "user"
  | "vendor"
  | "attendee"
  | "corporate_administrator"
  | "owner"

export interface Database {
  public: {
    Tables: {
      system_settings: {
        Row: {
          id: number
          key: string
          value: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          key: string
          value?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          key?: string
          value?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_agenda_templates: {
        Row: {
          id: number
          company_id: number
          title: string
          blocks: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          company_id: number
          title: string
          blocks?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          company_id?: number
          title?: string
          blocks?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          id: number
          name: string
          created_at: string
          updated_at: string
          default_meeting_sections: string[] | null
          default_meeting_types: string[] | null
          default_decision_results: string[] | null
          janus_integrated: boolean
          smtp_host: string | null
          smtp_port: number | null
          smtp_user: string | null
          smtp_password: string | null
          smtp_from_name: string | null
          smtp_from_email: string | null
          smtp_use_tls: boolean | null
          logo_url: string | null
          llm_provider: string | null
          llm_api_key: string | null
          llm_model: string | null
        }
        Insert: {
          id?: number
          name: string
          created_at?: string
          updated_at?: string
          default_meeting_sections?: string[] | null
          default_meeting_types?: string[] | null
          default_decision_results?: string[] | null
          janus_integrated?: boolean
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          smtp_password?: string | null
          smtp_from_name?: string | null
          smtp_from_email?: string | null
          smtp_use_tls?: boolean | null
          logo_url?: string | null
          llm_provider?: string | null
          llm_api_key?: string | null
          llm_model?: string | null
        }
        Update: {
          id?: number
          name?: string
          created_at?: string
          updated_at?: string
          default_meeting_sections?: string[] | null
          default_meeting_types?: string[] | null
          default_decision_results?: string[] | null
          janus_integrated?: boolean
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          smtp_password?: string | null
          smtp_from_name?: string | null
          smtp_from_email?: string | null
          smtp_use_tls?: boolean | null
          logo_url?: string | null
          llm_provider?: string | null
          llm_api_key?: string | null
          llm_model?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          id: number
          name: string
          email: string
          password_hash: string
          user_type: string
          roles: string[] | null
          company_id: number | null
          assigned_pm_id: number | null
          smtp_config: Json | null
          voting_weight: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          email: string
          password_hash: string
          user_type: string
          roles?: string[] | null
          company_id?: number | null
          assigned_pm_id?: number | null
          smtp_config?: Json | null
          voting_weight?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          email?: string
          password_hash?: string
          user_type?: string
          roles?: string[] | null
          company_id?: number | null
          assigned_pm_id?: number | null
          smtp_config?: Json | null
          voting_weight?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      buildings: {
        Row: {
          id: number
          manager_id: number
          name: string
          address: string | null
          company_id: number | null
          building_type: string
          logo_url: string | null
          header_text: string | null
          footer_text: string | null
          primary_color: string
          agenda_template: string | null
          minutes_template: string | null
          rules_document: Json | null
          rules_filename: string | null
          created_at: string
          updated_at: string
          board_meeting_notice_days: number | null
          general_meeting_notice_days: number | null
          notification_recipient_type: string | null
        }
        Insert: {
          id?: number
          manager_id: number
          name: string
          address?: string | null
          company_id?: number | null
          building_type?: string
          logo_url?: string | null
          header_text?: string | null
          footer_text?: string | null
          primary_color?: string
          agenda_template?: string | null
          minutes_template?: string | null
          rules_document?: Json | null
          rules_filename?: string | null
          created_at?: string
          updated_at?: string
          board_meeting_notice_days?: number | null
          general_meeting_notice_days?: number | null
          notification_recipient_type?: string | null
        }
        Update: {
          id?: number
          manager_id?: number
          name?: string
          address?: string | null
          company_id?: number | null
          building_type?: string
          logo_url?: string | null
          header_text?: string | null
          footer_text?: string | null
          primary_color?: string
          agenda_template?: string | null
          minutes_template?: string | null
          rules_document?: Json | null
          rules_filename?: string | null
          created_at?: string
          updated_at?: string
          board_meeting_notice_days?: number | null
          general_meeting_notice_days?: number | null
          notification_recipient_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      building_documents: {
        Row: {
          id: number
          building_id: number
          document_type: string
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          rules_and_regulations: string | null
          created_at: string
        }
        Insert: {
          id?: number
          building_id: number
          document_type: string
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          rules_and_regulations?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          building_id?: number
          document_type?: string
          filename?: string
          file_url?: string
          file_size?: number
          mime_type?: string
          rules_and_regulations?: string | null
          created_at?: string
        }
        Relationships: []
      }
      building_document_urls: {
        Row: {
          id: number
          building_id: number
          document_type: string
          url: string
          title: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: number
          building_id: number
          document_type: string
          url: string
          title: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          building_id?: number
          document_type?: string
          url?: string
          title?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      task_notes: {
        Row: {
          id: number
          task_id: number
          content: string
          created_by: number | null
          created_at: string
          visibility: string
          status: string | null
        }
        Insert: {
          id?: number
          task_id: number
          content: string
          created_by?: number | null
          created_at?: string
          visibility?: string
          status?: string | null
        }
        Update: {
          id?: number
          task_id?: number
          content?: string
          created_by?: number | null
          created_at?: string
          visibility?: string
          status?: string | null
        }
        Relationships: []
      }
      agendatemplates: {
        Row: {
          id: number
          buildingid: number
          coverpage_elements: Json | null
          infocard_fields: Json | null
          coverpage_color: string | null
          infocard_accent_color: string | null
          agenda_items_color: string | null
          createdat: string
          updatedat: string
        }
        Insert: {
          id?: number
          buildingid: number
          coverpage_elements?: Json | null
          infocard_fields?: Json | null
          coverpage_color?: string | null
          infocard_accent_color?: string | null
          agenda_items_color?: string | null
          createdat?: string
          updatedat?: string
        }
        Update: {
          id?: number
          buildingid?: number
          coverpage_elements?: Json | null
          infocard_fields?: Json | null
          coverpage_color?: string | null
          infocard_accent_color?: string | null
          agenda_items_color?: string | null
          createdat?: string
          updatedat?: string
        }
        Relationships: []
      }
      minutes_templates: {
        Row: {
          id: number
          building_id: number | null
          company_id: string | null
          title: string | null
          description: string | null
          scope: string | null
          canvas_content: Json | null
          coverpage_elements: Json | null
          infocard_fields: Json | null
          coverpage_color: string | null
          infocard_accent_color: string | null
          section_headers_color: string | null
          motion_boxes_color: string | null
          action_items_color: string | null
          vote_results_color: string | null
          coverpage_height: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          building_id?: number | null
          company_id?: string | null
          title?: string | null
          description?: string | null
          scope?: string | null
          canvas_content?: Json | null
          coverpage_elements?: Json | null
          infocard_fields?: Json | null
          coverpage_color?: string | null
          infocard_accent_color?: string | null
          section_headers_color?: string | null
          motion_boxes_color?: string | null
          action_items_color?: string | null
          vote_results_color?: string | null
          coverpage_height?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          building_id?: number | null
          company_id?: string | null
          title?: string | null
          description?: string | null
          scope?: string | null
          canvas_content?: Json | null
          coverpage_elements?: Json | null
          infocard_fields?: Json | null
          coverpage_color?: string | null
          infocard_accent_color?: string | null
          section_headers_color?: string | null
          motion_boxes_color?: string | null
          action_items_color?: string | null
          vote_results_color?: string | null
          coverpage_height?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_analyses: {
        Row: {
          id: number
          topic_id: number
          analysis_result: string
          created_at: string
        }
        Insert: {
          id?: number
          topic_id: number
          analysis_result: string
          created_at?: string
        }
        Update: {
          id?: number
          topic_id?: number
          analysis_result?: string
          created_at?: string
        }
        Relationships: []
      }
      user_buildings: {
        Row: {
          user_id: number
          building_id: number
          unit_number: string | null
          voting_weight: number
          user_building_type: string | null
          created_at: string
        }
        Insert: {
          user_id: number
          building_id: number
          unit_number?: string | null
          voting_weight?: number
          user_building_type?: string | null
          created_at?: string
        }
        Update: {
          user_id?: number
          building_id?: number
          unit_number?: string | null
          voting_weight?: number
          user_building_type?: string | null
          created_at?: string
        }
        Relationships: []
      }
      voting_parameters: {
        Row: {
          id: number
          company_id: number | null
          parameter_type: string
          value: string
          description: string | null
          is_default: boolean
          weight: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          company_id?: number | null
          parameter_type: string
          value: string
          description?: string | null
          is_default?: boolean
          weight?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          company_id?: number | null
          parameter_type?: string
          value?: string
          description?: string | null
          is_default?: boolean
          weight?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          id: number
          building_id: number
          title: string
          meeting_date: string
          location: string | null
          start_time: string | null
          meeting_type: string | null
          strata_plan_number: string | null
          status: string
          audio_file: Json | null
          audio_filename: string | null
          audio_duration: number | null
          recording_started_at: string | null
          recording_ended_at: string | null
          attendees: Json | null
          recorder_name: string | null
          timekeeper_name: string | null
          chair_person: string | null
          is_incamera: boolean
          meeting_transcript: string | null
          created_at: string
          updated_at: string
          finalized_at: string | null
          external_update_token: string | null
          token_expires_at: string | null
          end_time: string | null
          minute_taker: string | null
        }
        Insert: {
          id?: number
          building_id: number
          title: string
          meeting_date: string
          location?: string | null
          start_time?: string | null
          meeting_type?: string | null
          strata_plan_number?: string | null
          status?: string
          audio_file?: Json | null
          audio_filename?: string | null
          audio_duration?: number | null
          recording_started_at?: string | null
          recording_ended_at?: string | null
          attendees?: Json | null
          recorder_name?: string | null
          timekeeper_name?: string | null
          chair_person?: string | null
          is_incamera?: boolean
          meeting_transcript?: string | null
          created_at?: string
          updated_at?: string
          finalized_at?: string | null
          external_update_token?: string | null
          token_expires_at?: string | null
          end_time?: string | null
          minute_taker?: string | null
        }
        Update: {
          id?: number
          building_id?: number
          title?: string
          meeting_date?: string
          location?: string | null
          start_time?: string | null
          meeting_type?: string | null
          strata_plan_number?: string | null
          status?: string
          audio_file?: Json | null
          audio_filename?: string | null
          audio_duration?: number | null
          recording_started_at?: string | null
          recording_ended_at?: string | null
          attendees?: Json | null
          recorder_name?: string | null
          timekeeper_name?: string | null
          chair_person?: string | null
          is_incamera?: boolean
          meeting_transcript?: string | null
          created_at?: string
          updated_at?: string
          finalized_at?: string | null
          external_update_token?: string | null
          token_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          }
        ]
      }
      sections: {
        Row: {
          id: number
          meeting_id: number
          title: string
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          meeting_id: number
          title: string
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          meeting_id?: number
          title?: string
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          id: number
          meeting_id: number
          section_id: number | null
          title: string
          description: string | null
          order_index: number
          rolled_over_from_topic_id: number | null
          is_incamera: boolean
          incamera_start_time: string | null
          incamera_end_time: string | null
          time_per_topic: number | null
          created_by_name: string | null
          updated_by_name: string | null
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          meeting_id: number
          section_id?: number | null
          title: string
          description?: string | null
          order_index?: number
          rolled_over_from_topic_id?: number | null
          is_incamera?: boolean
          incamera_start_time?: string | null
          incamera_end_time?: string | null
          time_per_topic?: number | null
          created_by_name?: string | null
          updated_by_name?: string | null
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          meeting_id?: number
          section_id?: number | null
          title?: string
          description?: string | null
          order_index?: number
          rolled_over_from_topic_id?: number | null
          is_incamera?: boolean
          incamera_start_time?: string | null
          incamera_end_time?: string | null
          time_per_topic?: number | null
          created_by_name?: string | null
          updated_by_name?: string | null
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          id: number
          topic_id: number
          content: string
          created_by: number | null
          created_at: string
          visibility: string
          status: string | null
        }
        Insert: {
          id?: number
          topic_id: number
          content: string
          created_by?: number | null
          created_at?: string
          visibility?: string
          status?: string | null
        }
        Update: {
          id?: number
          topic_id?: number
          content?: string
          created_by?: number | null
          created_at?: string
          visibility?: string
          status?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: number
          topic_id: number
          description: string
          assigned_name: string | null
          assigned_email: string | null
          assignees: Json | null
          due_date: string | null
          status: string
          external_update_token: string | null
          token_expires_at: string | null
          created_by: number | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: number
          topic_id: number
          description: string
          assigned_name?: string | null
          assigned_email?: string | null
          assignees?: Json | null
          due_date?: string | null
          status?: string
          external_update_token?: string | null
          token_expires_at?: string | null
          created_by?: number | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: number
          topic_id?: number
          description?: string
          assigned_name?: string | null
          assigned_email?: string | null
          assignees?: Json | null
          due_date?: string | null
          status?: string
          external_update_token?: string | null
          token_expires_at?: string | null
          created_by?: number | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      decisions: {
        Row: {
          id: number
          topic_id: number
          motion_text: string
          result: string | null
          voting_type: string | null
          votes_for: number | null
          votes_against: number | null
          votes_abstain: number | null
          parent_decision_id: number | null
          recorded_by: number | null
          recorded_at: string
          edited_at: string | null
          status: string | null
        }
        Insert: {
          id?: number
          topic_id: number
          motion_text: string
          result?: string | null
          voting_type?: string | null
          votes_for?: number | null
          votes_against?: number | null
          votes_abstain?: number | null
          parent_decision_id?: number | null
          recorded_by?: number | null
          recorded_at?: string
          edited_at?: string | null
          status?: string | null
        }
        Update: {
          id?: number
          topic_id?: number
          motion_text?: string
          result?: string | null
          voting_type?: string | null
          votes_for?: number | null
          votes_against?: number | null
          votes_abstain?: number | null
          parent_decision_id?: number | null
          recorded_by?: number | null
          recorded_at?: string
          edited_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          id: number
          task_id: number
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          uploaded_by: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          task_id: number
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          uploaded_by?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          task_id?: number
          filename?: string
          file_url?: string
          file_size?: number
          mime_type?: string
          uploaded_by?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      topic_attachments: {
        Row: {
          id: number
          topic_id: number
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          uploaded_by: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          topic_id: number
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          uploaded_by?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          topic_id?: number
          filename?: string
          file_url?: string
          file_size?: number
          mime_type?: string
          uploaded_by?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_analyses: {
        Row: {
          id: number
          task_id: number
          task_description: string
          analysis_result: string
          created_at: string
        }
        Insert: {
          id?: number
          task_id: number
          task_description: string
          analysis_result: string
          created_at?: string
        }
        Update: {
          id?: number
          task_id?: number
          task_description?: string
          analysis_result?: string
          created_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          user_id: number | null
          company_id: number | null
          action_type: string
          model_name: string | null
          status: string
          duration_ms: number | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: number | null
          company_id?: number | null
          action_type: string
          model_name?: string | null
          status: string
          duration_ms?: number | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: number | null
          company_id?: number | null
          action_type?: string
          model_name?: string | null
          status?: string
          duration_ms?: number | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: []
      }
      janus_repairs: {
        Row: {
          id: number
          building_id: number
          building_name: string | null
          company_id: number | null
          title: string
          priority: string
          status: string
          description: string | null
          budget: string | null
          estimated_cost: string | null
          quoted_amount: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          building_id: number
          building_name?: string | null
          company_id?: number | null
          title: string
          priority: string
          status: string
          description?: string | null
          budget?: string | null
          estimated_cost?: string | null
          quoted_amount?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          building_id?: number
          building_name?: string | null
          company_id?: number | null
          title?: string
          priority?: string
          status?: string
          description?: string | null
          budget?: string | null
          estimated_cost?: string | null
          quoted_amount?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      janus_complaints: {
        Row: {
          id: number
          building_id: number
          building_name: string | null
          company_id: number | null
          title: string
          description: string | null
          priority: string | null
          status: string
          budget: string | null
          estimated_cost: string | null
          quoted_amount: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          building_id: number
          building_name?: string | null
          company_id?: number | null
          title: string
          description?: string | null
          priority?: string | null
          status: string
          budget?: string | null
          estimated_cost?: string | null
          quoted_amount?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          building_id?: number
          building_name?: string | null
          company_id?: number | null
          title?: string
          description?: string | null
          priority?: string | null
          status?: string
          budget?: string | null
          estimated_cost?: string | null
          quoted_amount?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      section_attachments: {
        Row: {
          id: number
          section_id: number
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          section_id: number
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          section_id?: number
          filename?: string
          file_url?: string
          file_size?: number
          mime_type?: string
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_transcripts: {
        Row: {
          id: number
          meeting_id: number
          transcript_text: string | null
          filename: string | null
          file_url: string | null
          file_size: number | null
          mime_type: string | null
          parsed_json: Json | null
          uploaded_by: number | null
          created_at: string
          updated_at: string
          tasks_created_count: number | null
        }
        Insert: {
          id?: number
          meeting_id: number
          transcript_text?: string | null
          filename?: string | null
          file_url?: string | null
          file_size?: number | null
          mime_type?: string | null
          parsed_json?: Json | null
          uploaded_by?: number | null
          created_at?: string
          updated_at?: string
          tasks_created_count?: number | null
        }
        Update: {
          id?: number
          meeting_id?: number
          transcript_text?: string | null
          filename?: string | null
          file_url?: string | null
          file_size?: number | null
          mime_type?: string | null
          parsed_json?: Json | null
          uploaded_by?: number | null
          created_at?: string
          updated_at?: string
          tasks_created_count?: number | null
        }
        Relationships: []
      }
      genius_words: {
        Row: {
          id: number
          user_id: number | null
          shortcode: string
          description: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id?: number | null
          shortcode: string
          description: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: number | null
          shortcode?: string
          description?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper Interfaces
export interface Company {
  id: number
  name: string
  created_at: string
  updated_at: string
  default_meeting_sections?: string[] | null
  default_meeting_types?: string[] | null
  default_decision_results?: string[] | null
  janus_integrated?: boolean
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_user?: string | null
  smtp_password?: string | null
  smtp_from_name?: string | null
  smtp_from_email?: string | null
  smtp_use_tls?: boolean | null
  logo_url?: string | null
  llm_provider?: string | null
  llm_api_key?: string | null
  llm_model?: string | null
}

export interface User {
  id: number
  name: string
  email: string
  user_type: UserRole
  roles?: UserRole[] | null
  company_id?: number | null
  assigned_pm_id?: number | null
}

export interface TaskAttachment {
  id: number
  task_id: number
  filename: string
  file_url: string
  file_size: number
  mime_type: string
  uploaded_by: number | null
  created_at: string
  updated_at: string
}

export interface TopicAttachment {
  id: number
  topic_id: number
  filename: string
  file_url: string
  file_size: number
  mime_type: string
  uploaded_by: number | null
  created_at: string
  updated_at: string
}

export interface TaskAnalysis {
  id: number
  task_id: number
  task_description: string
  analysis_result: string
  created_at: string
}

export interface JanusRepair {
  id: number
  building_id: number
  building_name?: string | null
  company_id?: number | null
  title: string
  priority: string
  status: string
  description?: string | null
  budget?: string | null
  estimated_cost?: string | null
  quoted_amount?: string | null
  created_at: string
  updated_at: string
}

export interface JanusComplaint {
  id: number
  building_id: number
  building_name?: string | null
  company_id?: number | null
  title: string
  description: string | null
  priority?: string | null
  status: string
  budget?: string | null
  estimated_cost?: string | null
  quoted_amount?: string | null
  created_at: string
  updated_at: string
}

// ============================================
// CLIENT INITIALIZATION (SINGLETON)
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Fix: Use globalThis for better compatibility and ensure client is stored
const globalForSupabase = globalThis as unknown as { 
  supabase: SupabaseClient<Database> | undefined,
  supabaseAdmin: SupabaseClient<Database> | undefined 
}

export const supabase = globalForSupabase.supabase ?? createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: { 'x-application-name': 'meeting-genius' }
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabase = supabase
}

export function createClient() {
  return supabase
}

export function createAdminClient() {
  // If called on the client side (browser), SUPABASE_SERVICE_ROLE_KEY is not available.
  // Return the regular supabase client which has full access via anon key / user session.
  if (typeof window !== 'undefined') {
    return supabase
  }

  if (globalForSupabase.supabaseAdmin) {
    return globalForSupabase.supabaseAdmin
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const client = createSupabaseClient<Database>(supabaseUrl, key, {
    auth: { 
      persistSession: false, 
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  if (process.env.NODE_ENV !== 'production') {
    globalForSupabase.supabaseAdmin = client
  } else {
    // In production, we still want to cache it in the module at least
    globalForSupabase.supabaseAdmin = client
  }

  return client
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null
  const userJson = localStorage.getItem("current_user")
  if (!userJson) return null
  try {
    return JSON.parse(userJson)
  } catch {
    return null
  }
}

export function setCurrentUser(user: User) {
  if (typeof window !== "undefined") {
    localStorage.setItem("current_user", JSON.stringify(user))
  }
}

export function clearCurrentUser() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("current_user")
  }
}

export function isLoggedIn(): boolean {
  return getCurrentUser() !== null
}

export async function getSupabaseUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    console.error("Error getting authenticated user:", error)
    return null
  }
  return user
}

// ROLLOVER HELPER FUNCTIONS

export async function getPreviousMeetingOfSameType(
  buildingId: number,
  meetingType: string,
  excludeMeetingId?: number,
) {
  let query = supabase
    .from("meetings")
    .select("id, title, meeting_date, attendees")
    .eq("building_id", buildingId)
    .eq("meeting_type", meetingType)
    .order("meeting_date", { ascending: false })
    .limit(1)

  if (excludeMeetingId) {
    query = query.neq("id", excludeMeetingId)
  }

  const { data, error } = await query.single()

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching previous meeting:", error)
    return null
  }

  return data ?? null
}

export async function getSectionsFromMeeting(meetingId: number) {
  const { data, error } = await supabase
    .from("sections")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("order_index")

  if (error) {
    console.error("Error fetching sections:", error)
    return []
  }

  return data || []
}

export async function getTopicsFromMeeting(meetingId: number) {
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("order_index")

  if (error) {
    console.error("Error fetching topics:", error)
    return []
  }

  return data || []
}

export async function getOpenTasksFromMeeting(meetingId: number) {
  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id")
    .eq("meeting_id", meetingId)

  if (topicsError || !topics || topics.length === 0) {
    return []
  }

  const topicIds = topics.map((t) => t.id)

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .in("topic_id", topicIds)
    .in("status", ["open", "in_progress"])

  if (tasksError) {
    console.error("Error fetching open tasks:", tasksError)
    return []
  }

  return tasks || []
}

export async function getCompanyDefaultSections(companyId: number) {
  const { data, error } = await supabase
    .from("companies")
    .select("default_meeting_sections")
    .eq("id", companyId)
    .single()

  if (error) {
    console.error("Error fetching company defaults:", error)
    return null
  }

  return data?.default_meeting_sections || null
}

export async function getVotingParameters(companyId?: number | null) {
  const adminClient = createAdminClient()
  let query = adminClient
    .from("voting_parameters")
    .select("*")
    .order("value")

  if (companyId !== null && companyId !== undefined) {
    query = query.or(`company_id.is.null,company_id.eq.${companyId}`)
  } else {
    // If no company context is provided, only return global defaults
    query = query.is("company_id", null)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching voting parameters:", error)
    return []
  }

  if (!data) return []

  // Deduplicate by parameter_type + value, giving precedence to company-specific overrides (company_id !== null) over global defaults (company_id === null)
  const dedupedMap = new Map<string, any>()
  for (const item of data) {
    const key = `${item.parameter_type}:${item.value}`
    const existing = dedupedMap.get(key)
    if (!existing || (existing.company_id === null && item.company_id !== null)) {
      dedupedMap.set(key, item)
    }
  }

  return Array.from(dedupedMap.values())
}

