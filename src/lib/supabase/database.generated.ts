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
      admin_audit_events: {
        Row: {
          action: string
          actor_user_id: string
          id: string
          occurred_at: string
          operation_id: string
          phase: string
          target_user_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          id?: string
          occurred_at?: string
          operation_id: string
          phase: string
          target_user_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          id?: string
          occurred_at?: string
          operation_id?: string
          phase?: string
          target_user_id?: string
        }
        Relationships: []
      }
      calendar_accounts: {
        Row: {
          created_at: string
          credential_version: number
          email: string
          google_sub: string
          id: string
          last_synced_at: string | null
          revision: number
          scopes: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_version?: number
          email: string
          google_sub: string
          id?: string
          last_synced_at?: string | null
          revision?: number
          scopes: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_version?: number
          email?: string
          google_sub?: string
          id?: string
          last_synced_at?: string | null
          revision?: number
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          account_id: string
          all_day: boolean
          calendar_id: string
          ends_at: string
          google_id: string
          html_link: string | null
          id: string
          linked_capture_id: string | null
          location: string | null
          reminder_minutes: number | null
          starts_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          all_day: boolean
          calendar_id: string
          ends_at: string
          google_id: string
          html_link?: string | null
          id?: string
          linked_capture_id?: string | null
          location?: string | null
          reminder_minutes?: number | null
          starts_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          all_day?: boolean
          calendar_id?: string
          ends_at?: string
          google_id?: string
          html_link?: string | null
          id?: string
          linked_capture_id?: string | null
          location?: string | null
          reminder_minutes?: number | null
          starts_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_user_id_account_id_calendar_id_fkey"
            columns: ["user_id", "account_id", "calendar_id"]
            isOneToOne: false
            referencedRelation: "calendar_sources"
            referencedColumns: ["user_id", "account_id", "id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_account_id_fkey"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_linked_capture_id_fkey"
            columns: ["user_id", "linked_capture_id"]
            isOneToOne: false
            referencedRelation: "captures"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      calendar_sources: {
        Row: {
          account_id: string
          color_key: string
          google_id: string
          id: string
          name: string
          selected: boolean
          user_id: string
        }
        Insert: {
          account_id: string
          color_key?: string
          google_id: string
          id?: string
          name: string
          selected?: boolean
          user_id: string
        }
        Update: {
          account_id?: string
          color_key?: string
          google_id?: string
          id?: string
          name?: string
          selected?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sources_user_id_account_id_fkey"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      calendar_sync_runs: {
        Row: {
          account_id: string | null
          calendar_count: number
          channel: string
          event_count: number
          finished_at: string | null
          id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          calendar_count?: number
          channel: string
          event_count?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          calendar_count?: number
          channel?: string
          event_count?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      capture_file_links: {
        Row: {
          capture_id: string
          file_id: string
          user_id: string
        }
        Insert: {
          capture_id: string
          file_id: string
          user_id: string
        }
        Update: {
          capture_id?: string
          file_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_file_links_user_id_capture_id_fkey"
            columns: ["user_id", "capture_id"]
            isOneToOne: false
            referencedRelation: "captures"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "capture_file_links_user_id_file_id_fkey"
            columns: ["user_id", "file_id"]
            isOneToOne: false
            referencedRelation: "drive_files"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      capture_links: {
        Row: {
          source_id: string
          target_id: string
          user_id: string
        }
        Insert: {
          source_id: string
          target_id: string
          user_id: string
        }
        Update: {
          source_id?: string
          target_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_links_user_id_source_id_fkey"
            columns: ["user_id", "source_id"]
            isOneToOne: false
            referencedRelation: "captures"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "capture_links_user_id_target_id_fkey"
            columns: ["user_id", "target_id"]
            isOneToOne: false
            referencedRelation: "captures"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      captures: {
        Row: {
          archived_at: string | null
          category_id: string | null
          client_id: string
          converted_task_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          payload: Json
          project_id: string | null
          search_document: string | null
          search_terms: unknown
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category_id?: string | null
          client_id: string
          converted_task_id?: string | null
          created_at: string
          deleted_at?: string | null
          id: string
          payload: Json
          project_id?: string | null
          search_document?: string | null
          search_terms?: unknown
          status: string
          updated_at: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string | null
          client_id?: string
          converted_task_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          payload?: Json
          project_id?: string | null
          search_document?: string | null
          search_terms?: unknown
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "captures_converted_task_fk"
            columns: ["user_id", "converted_task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "captures_user_id_category_id_fkey"
            columns: ["user_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "captures_user_id_project_id_fkey"
            columns: ["user_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          id: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domain_events: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          canal: string
          capture_task_payload: Json | null
          entity_id: string
          entity_type: string
          id: string
          occurred_at: string
          user_id: string
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          canal: string
          capture_task_payload?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          occurred_at?: string
          user_id: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          canal?: string
          capture_task_payload?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          occurred_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drive_files: {
        Row: {
          bytes: number
          created_at: string
          deleted_at: string | null
          deletion_batch_id: string | null
          folder_id: string | null
          height: number | null
          id: string
          kind: string
          mime: string
          name: string
          payload: Json
          purged_at: string | null
          search_document: string | null
          search_terms: unknown
          sha256: string
          storage_path: string
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          bytes: number
          created_at: string
          deleted_at?: string | null
          deletion_batch_id?: string | null
          folder_id?: string | null
          height?: number | null
          id: string
          kind: string
          mime: string
          name: string
          payload: Json
          purged_at?: string | null
          search_document?: string | null
          search_terms?: unknown
          sha256: string
          storage_path: string
          updated_at: string
          user_id: string
          width?: number | null
        }
        Update: {
          bytes?: number
          created_at?: string
          deleted_at?: string | null
          deletion_batch_id?: string | null
          folder_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime?: string
          name?: string
          payload?: Json
          purged_at?: string | null
          search_document?: string | null
          search_terms?: unknown
          sha256?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_files_user_id_folder_id_fkey"
            columns: ["user_id", "folder_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      drive_folders: {
        Row: {
          created_at: string
          deleted_at: string | null
          deletion_batch_id: string | null
          id: string
          name: string
          parent_id: string | null
          payload: Json
          position: number
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          deletion_batch_id?: string | null
          id: string
          name: string
          parent_id?: string | null
          payload: Json
          position: number
          project_id?: string | null
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deletion_batch_id?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          payload?: Json
          position?: number
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_folders_user_id_parent_id_fkey"
            columns: ["user_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "drive_folders"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "drive_folders_user_id_project_id_fkey"
            columns: ["user_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      fin_accounts: {
        Row: {
          archived_at: string | null
          color_key: string | null
          created_at: string
          credit_limit_cents: number | null
          currency: string
          id: string
          institution: string | null
          kind: string
          name: string
          opening_balance_cents: number
          payload: Json
          payment_due_day: number | null
          statement_closing_day: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color_key?: string | null
          created_at: string
          credit_limit_cents?: number | null
          currency: string
          id: string
          institution?: string | null
          kind: string
          name: string
          opening_balance_cents: number
          payload: Json
          payment_due_day?: number | null
          statement_closing_day?: number | null
          updated_at: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          color_key?: string | null
          created_at?: string
          credit_limit_cents?: number | null
          currency?: string
          id?: string
          institution?: string | null
          kind?: string
          name?: string
          opening_balance_cents?: number
          payload?: Json
          payment_due_day?: number | null
          statement_closing_day?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_budgets: {
        Row: {
          category_id: string
          created_at: string
          id: string
          limit_cents: number
          month: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at: string
          id: string
          limit_cents: number
          month: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          limit_cents?: number
          month?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_budgets_user_id_category_id_fkey"
            columns: ["user_id", "category_id"]
            isOneToOne: false
            referencedRelation: "fin_categories"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      fin_categories: {
        Row: {
          color_key: string | null
          created_at: string
          id: string
          kind: string
          name: string
          normalized_name: string
          parent_id: string | null
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          color_key?: string | null
          created_at: string
          id: string
          kind: string
          name: string
          normalized_name: string
          parent_id?: string | null
          payload: Json
          updated_at: string
          user_id: string
        }
        Update: {
          color_key?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          normalized_name?: string
          parent_id?: string | null
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_categories_user_id_parent_id_fkey"
            columns: ["user_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "fin_categories"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      fin_tags: {
        Row: {
          color_key: string | null
          created_at: string
          id: string
          name: string
          normalized_name: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          color_key?: string | null
          created_at: string
          id: string
          name: string
          normalized_name: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Update: {
          color_key?: string | null
          created_at?: string
          id?: string
          name?: string
          normalized_name?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_transaction_tags: {
        Row: {
          tag_id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          tag_id: string
          transaction_id: string
          user_id: string
        }
        Update: {
          tag_id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_transaction_tags_user_id_tag_id_fkey"
            columns: ["user_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "fin_tags"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "fin_transaction_tags_user_id_transaction_id_fkey"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "fin_transactions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      fin_transactions: {
        Row: {
          account_id: string
          amount_cents: number
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          due_date: string | null
          id: string
          installment_group_id: string | null
          installment_no: number | null
          installment_total: number | null
          is_paid: boolean | null
          kind: string
          notes: string | null
          occurred_on: string
          paid_cents: number
          payee: string | null
          payload: Json
          search_document: string | null
          search_terms: unknown
          serie_tipo: string | null
          source: string
          statement_month: string | null
          status: string
          transfer_group_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          category_id?: string | null
          created_at: string
          deleted_at?: string | null
          description: string
          due_date?: string | null
          id: string
          installment_group_id?: string | null
          installment_no?: number | null
          installment_total?: number | null
          is_paid?: boolean | null
          kind: string
          notes?: string | null
          occurred_on: string
          paid_cents: number
          payee?: string | null
          payload: Json
          search_document?: string | null
          search_terms?: unknown
          serie_tipo?: string | null
          source: string
          statement_month?: string | null
          status: string
          transfer_group_id?: string | null
          updated_at: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          installment_group_id?: string | null
          installment_no?: number | null
          installment_total?: number | null
          is_paid?: boolean | null
          kind?: string
          notes?: string | null
          occurred_on?: string
          paid_cents?: number
          payee?: string | null
          payload?: Json
          search_document?: string | null
          search_terms?: unknown
          serie_tipo?: string | null
          source?: string
          statement_month?: string | null
          status?: string
          transfer_group_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_transactions_user_id_account_id_fkey"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "fin_account_balances"
            referencedColumns: ["user_id", "account_id"]
          },
          {
            foreignKeyName: "fin_transactions_user_id_account_id_fkey"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "fin_accounts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "fin_transactions_user_id_category_id_fkey"
            columns: ["user_id", "category_id"]
            isOneToOne: false
            referencedRelation: "fin_categories"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      habit_entries: {
        Row: {
          created_at: string
          done_on: string
          habit_id: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at: string
          done_on: string
          habit_id: string
          id: string
          payload: Json
          user_id: string
        }
        Update: {
          created_at?: string
          done_on?: string
          habit_id?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_entries_user_id_habit_id_fkey"
            columns: ["user_id", "habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      habit_pauses: {
        Row: {
          created_at: string
          ends_on: string | null
          habit_id: string | null
          id: string
          payload: Json
          starts_on: string
          user_id: string
        }
        Insert: {
          created_at: string
          ends_on?: string | null
          habit_id?: string | null
          id: string
          payload: Json
          starts_on: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          habit_id?: string | null
          id?: string
          payload?: Json
          starts_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_pauses_user_id_habit_id_fkey"
            columns: ["user_id", "habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          payload: Json
          schedule_kind: string
          search_document: string | null
          search_terms: unknown
          started_on: string
          updated_at: string
          user_id: string
          weekdays: number[]
          weekly_target: number | null
        }
        Insert: {
          archived_at?: string | null
          created_at: string
          id: string
          name: string
          payload: Json
          schedule_kind: string
          search_document?: string | null
          search_terms?: unknown
          started_on: string
          updated_at: string
          user_id: string
          weekdays: number[]
          weekly_target?: number | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          payload?: Json
          schedule_kind?: string
          search_document?: string | null
          search_terms?: unknown
          started_on?: string
          updated_at?: string
          user_id?: string
          weekdays?: number[]
          weekly_target?: number | null
        }
        Relationships: []
      }
      knowledge_notebooks: {
        Row: {
          created_at: string
          deleted_at: string | null
          deletion_batch_id: string | null
          id: string
          payload: Json
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          deletion_batch_id?: string | null
          id: string
          payload: Json
          project_id?: string | null
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deletion_batch_id?: string | null
          id?: string
          payload?: Json
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_notebooks_user_id_project_id_fkey"
            columns: ["user_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      knowledge_pages: {
        Row: {
          archived_at: string | null
          content_text: string
          created_at: string
          deleted_at: string | null
          deletion_batch_id: string | null
          document: Json
          id: string
          normalized_title: string
          notebook_id: string
          origin_capture_id: string | null
          parent_id: string | null
          payload: Json
          search_document: string | null
          search_terms: unknown
          search_vector: unknown
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          content_text: string
          created_at: string
          deleted_at?: string | null
          deletion_batch_id?: string | null
          document: Json
          id: string
          normalized_title: string
          notebook_id: string
          origin_capture_id?: string | null
          parent_id?: string | null
          payload: Json
          search_document?: string | null
          search_terms?: unknown
          search_vector?: unknown
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Update: {
          archived_at?: string | null
          content_text?: string
          created_at?: string
          deleted_at?: string | null
          deletion_batch_id?: string | null
          document?: Json
          id?: string
          normalized_title?: string
          notebook_id?: string
          origin_capture_id?: string | null
          parent_id?: string | null
          payload?: Json
          search_document?: string | null
          search_terms?: unknown
          search_vector?: unknown
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_pages_user_id_notebook_id_fkey"
            columns: ["user_id", "notebook_id"]
            isOneToOne: false
            referencedRelation: "knowledge_notebooks"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "knowledge_pages_user_id_origin_capture_id_fkey"
            columns: ["user_id", "origin_capture_id"]
            isOneToOne: true
            referencedRelation: "captures"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "knowledge_pages_user_id_parent_id_fkey"
            columns: ["user_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_pages"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      links: {
        Row: {
          created_at: string
          deleted_at: string | null
          from_id: string
          from_type: string
          id: string
          payload: Json
          to_id: string
          to_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          from_id: string
          from_type: string
          id: string
          payload: Json
          to_id: string
          to_type: string
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          from_id?: string
          from_type?: string
          id?: string
          payload?: Json
          to_id?: string
          to_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_refs: {
        Row: {
          alias: string
          created_at: string
          id: string
          normalized_alias: string
          page_id: string
          target_id: string | null
          user_id: string
        }
        Insert: {
          alias: string
          created_at: string
          id: string
          normalized_alias: string
          page_id: string
          target_id?: string | null
          user_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          normalized_alias?: string
          page_id?: string
          target_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_refs_user_id_page_id_fkey"
            columns: ["user_id", "page_id"]
            isOneToOne: false
            referencedRelation: "knowledge_pages"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "page_refs_user_id_target_id_fkey"
            columns: ["user_id", "target_id"]
            isOneToOne: false
            referencedRelation: "knowledge_pages"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_file_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          locale: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_file_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          locale?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_file_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          locale?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_file_owner_fk"
            columns: ["user_id", "avatar_file_id"]
            isOneToOne: false
            referencedRelation: "drive_files"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          payload: Json
          search_document: string | null
          search_terms: unknown
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          deleted_at?: string | null
          id: string
          payload: Json
          search_document?: string | null
          search_terms?: unknown
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          payload?: Json
          search_document?: string | null
          search_terms?: unknown
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          archived_at: string | null
          category_id: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          id: string
          origin_capture_id: string | null
          payload: Json
          project_id: string | null
          search_document: string | null
          search_terms: unknown
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category_id?: string | null
          client_id: string
          created_at: string
          deleted_at?: string | null
          id: string
          origin_capture_id?: string | null
          payload: Json
          project_id?: string | null
          search_document?: string | null
          search_terms?: unknown
          status: string
          updated_at: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          origin_capture_id?: string | null
          payload?: Json
          project_id?: string | null
          search_document?: string | null
          search_terms?: unknown
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_category_id_fkey"
            columns: ["user_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "tasks_user_id_origin_capture_id_fkey"
            columns: ["user_id", "origin_capture_id"]
            isOneToOne: true
            referencedRelation: "captures"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "tasks_user_id_project_id_fkey"
            columns: ["user_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      user_entitlements: {
        Row: {
          allowed: boolean
          feature_key: string
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          allowed: boolean
          feature_key: string
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          allowed?: boolean
          feature_key?: string
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_moderation: {
        Row: {
          changed_at: string
          changed_by: string | null
          must_change_password: boolean
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          must_change_password?: boolean
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          must_change_password?: boolean
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_modules: {
        Row: {
          created_at: string
          module_key: string
          sort_order: number
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          module_key: string
          sort_order?: number
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          module_key?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          default_calendar_view: string
          meeting_reminder_minutes: number
          meeting_reminders_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
          values_hidden: boolean
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          default_calendar_view?: string
          meeting_reminder_minutes?: number
          meeting_reminders_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
          values_hidden?: boolean
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          default_calendar_view?: string
          meeting_reminder_minutes?: number
          meeting_reminders_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
          values_hidden?: boolean
          week_starts_on?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      vault_items: {
        Row: {
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          id: string
          payload: Json
          user_id: string
        }
        Update: {
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "vault_master_keys"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vault_master_keys: {
        Row: {
          payload: Json
          user_id: string
        }
        Insert: {
          payload: Json
          user_id: string
        }
        Update: {
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      fin_account_balances: {
        Row: {
          account_id: string | null
          balance_cents: number | null
          currency: string | null
          kind: string | null
          name: string | null
          opening_balance_cents: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activity_page: {
        Args: {
          p_before_id?: string
          p_before_time?: string
          p_limit?: number
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      admin_claim: {
        Args: {
          p_actor: string
          p_execution: string
          p_operation: string
          p_session: string
        }
        Returns: Json
      }
      admin_complete: {
        Args: {
          p_actor: string
          p_execution: string
          p_operation: string
          p_session: string
        }
        Returns: Json
      }
      admin_operation_guard: {
        Args: {
          p_actor: string
          p_execution: string
          p_operation: string
          p_session: string
        }
        Returns: Json
      }
      admin_reserve: {
        Args: {
          p_actor: string
          p_execution: string
          p_intent: Json
          p_session: string
        }
        Returns: Json
      }
      admin_snapshot: {
        Args: { p_actor: string; p_session: string }
        Returns: Json
      }
      admin_transition: {
        Args: {
          p_actor: string
          p_execution: string
          p_operation: string
          p_phase: string
          p_release?: boolean
          p_session: string
        }
        Returns: Json
      }
      bootstrap_master: { Args: { p_user: string }; Returns: undefined }
      capture_task_commit: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      capture_task_receipt: {
        Args: {
          p_client_id: string
          p_command: string
          p_operation: string
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      capture_task_revision: {
        Args: { p_operation: string; p_session: string; p_user: string }
        Returns: string
      }
      capture_task_snapshot: {
        Args: { p_operation: string; p_session: string; p_user: string }
        Returns: Json
      }
      close_account: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      complete_password_change: {
        Args: { p_client_id: string; p_session: string; p_user: string }
        Returns: Json
      }
      consume_rate_limit: {
        Args: {
          p_scope: string
          p_session?: string
          p_subject_hash: string
          p_user?: string
        }
        Returns: Json
      }
      create_series: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      drive_commit: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      drive_receipt: {
        Args: {
          p_client_id: string
          p_command: string
          p_operation: string
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      drive_snapshot: {
        Args: {
          p_max_bytes: number
          p_operation: string
          p_quota: number
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      file_avatar_set: {
        Args: {
          p_client_id: string
          p_file: string
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      file_cleanup_ack: { Args: { p_upload: string }; Returns: undefined }
      file_cleanup_candidates: { Args: never; Returns: Json }
      file_cleanup_log: {
        Args: { p_failed: number; p_removed: number }
        Returns: undefined
      }
      file_read_metadata: {
        Args: { p_file: string; p_session: string; p_user: string }
        Returns: Json
      }
      file_upload_claim: {
        Args: {
          p_client_id: string
          p_lease: string
          p_session: string
          p_upload: string
          p_user: string
        }
        Returns: Json
      }
      file_upload_complete: {
        Args: {
          p_client_id: string
          p_file: Json
          p_lease: string
          p_quota: number
          p_session: string
          p_upload: string
          p_user: string
        }
        Returns: Json
      }
      file_upload_release: {
        Args: {
          p_lease: string
          p_session: string
          p_upload: string
          p_user: string
        }
        Returns: undefined
      }
      file_upload_reserve: {
        Args: {
          p_client_id: string
          p_expires: string
          p_folder: string
          p_kind: string
          p_max_bytes: number
          p_name: string
          p_quota: number
          p_session: string
          p_upload: string
          p_user: string
        }
        Returns: Json
      }
      file_upload_status: {
        Args: { p_session: string; p_upload: string; p_user: string }
        Returns: Json
      }
      finance_commit: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      finance_receipt: {
        Args: {
          p_client_id: string
          p_command: string
          p_operation: string
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      finance_revision: {
        Args: { p_operation: string; p_session: string; p_user: string }
        Returns: string
      }
      finance_snapshot: {
        Args: { p_operation: string; p_session: string; p_user: string }
        Returns: Json
      }
      global_search: {
        Args: { p_session: string; p_term: string; p_user: string }
        Returns: Json
      }
      google_calendar_admin_runs: {
        Args: { p_actor: string; p_session: string }
        Returns: Json
      }
      google_calendar_call: {
        Args: {
          p_command: string
          p_cron: boolean
          p_execution: string
          p_input: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      google_calendar_jobs: { Args: never; Returns: Json }
      knowledge_capture_origins: {
        Args: { p_operation: string; p_session: string; p_user: string }
        Returns: Json
      }
      knowledge_commit: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      knowledge_receipt: {
        Args: {
          p_client_id: string
          p_command: string
          p_operation: string
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      knowledge_snapshot: {
        Args: { p_operation: string; p_session: string; p_user: string }
        Returns: Json
      }
      my_access_state: { Args: never; Returns: Json }
      pay_statement: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      projects_habits_commit: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      projects_habits_receipt: {
        Args: {
          p_client_id: string
          p_command: string
          p_operation: string
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      projects_habits_snapshot: {
        Args: { p_operation: string; p_session: string; p_user: string }
        Returns: Json
      }
      prune_operational_data: { Args: never; Returns: Json }
      settings_commit: {
        Args: { p_request: Json; p_session: string; p_user: string }
        Returns: Json
      }
      settings_snapshot: {
        Args: { p_session: string; p_user: string }
        Returns: Json
      }
      transfer: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      update_identity: {
        Args: {
          p_canal?: string
          p_client_id: string
          p_patch: Json
          p_resource: string
        }
        Returns: Json
      }
      vault_commit: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      vault_receipt: {
        Args: {
          p_operation: string
          p_request: Json
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      vault_snapshot: {
        Args: { p_operation: string; p_session: string; p_user: string }
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
