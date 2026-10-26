// ---------------------------------------------------------------------------
// GENERATED FILE — do not edit by hand.
// Regenerate with:  pnpm db:types
// Source: scripts/gen-db-types.mjs, read straight from the PostgreSQL catalog.
// ---------------------------------------------------------------------------

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activity_participants: {
        Row: {
          id: string
          activity_id: string
          membership_id: string
          performance_type: string | null
          age_group: string | null
          experience: string | null
          special_requirements: string | null
          channel: Database["public"]["Enums"]["origin_channel"]
          joined_at: string
          participant_name: string | null
        }
        Insert: {
          id?: string
          activity_id: string
          membership_id: string
          performance_type?: string | null
          age_group?: string | null
          experience?: string | null
          special_requirements?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          joined_at?: string
          participant_name?: string | null
        }
        Update: {
          id?: string
          activity_id?: string
          membership_id?: string
          performance_type?: string | null
          age_group?: string | null
          experience?: string | null
          special_requirements?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          joined_at?: string
          participant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "event_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      activity_suggestions: {
        Row: {
          id: string
          community_id: string
          event_id: string | null
          name: string
          description: string | null
          expected_participants: number | null
          wants_to_coordinate: boolean
          status: Database["public"]["Enums"]["suggestion_status"]
          suggested_by: string | null
          review_note: string | null
          created_at: string
          updated_at: string
          kind: string
          resolved_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          community_id: string
          event_id?: string | null
          name: string
          description?: string | null
          expected_participants?: number | null
          wants_to_coordinate?: boolean
          status?: Database["public"]["Enums"]["suggestion_status"]
          suggested_by?: string | null
          review_note?: string | null
          created_at?: string
          updated_at?: string
          kind?: string
          resolved_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          community_id?: string
          event_id?: string | null
          name?: string
          description?: string | null
          expected_participants?: number | null
          wants_to_coordinate?: boolean
          status?: Database["public"]["Enums"]["suggestion_status"]
          suggested_by?: string | null
          review_note?: string | null
          created_at?: string
          updated_at?: string
          kind?: string
          resolved_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_suggestions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_suggestions_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_suggestions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      apple_refresh_tokens: {
        Row: {
          user_id: string
          refresh_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          refresh_token: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          refresh_token?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          membership_id: string
          read_at: string
        }
        Insert: {
          announcement_id: string
          membership_id: string
          read_at?: string
        }
        Update: {
          announcement_id?: string
          membership_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      announcements: {
        Row: {
          id: string
          community_id: string
          author_id: string | null
          event_id: string | null
          title: string
          body: string
          audience: Database["public"]["Enums"]["announcement_audience"]
          is_pinned: boolean
          published_at: string
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          author_id?: string | null
          event_id?: string | null
          title: string
          body: string
          audience?: Database["public"]["Enums"]["announcement_audience"]
          is_pinned?: boolean
          published_at?: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          author_id?: string | null
          event_id?: string | null
          title?: string
          body?: string
          audience?: Database["public"]["Enums"]["announcement_audience"]
          is_pinned?: boolean
          published_at?: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      api_key_secrets: {
        Row: {
          api_key_id: string
          key_hash: string
        }
        Insert: {
          api_key_id: string
          key_hash: string
        }
        Update: {
          api_key_id?: string
          key_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_secrets_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          }
        ]
      }
      api_keys: {
        Row: {
          id: string
          community_id: string
          name: string
          key_prefix: string
          scopes: string[]
          acts_as: string | null
          created_by: string | null
          last_used_at: string | null
          expires_at: string | null
          revoked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          name: string
          key_prefix: string
          scopes?: string[]
          acts_as?: string | null
          created_by?: string | null
          last_used_at?: string | null
          expires_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          name?: string
          key_prefix?: string
          scopes?: string[]
          acts_as?: string | null
          created_by?: string | null
          last_used_at?: string | null
          expires_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_acts_as_fkey"
            columns: ["acts_as"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_log: {
        Row: {
          id: number
          community_id: string
          table_name: string
          row_id: string
          action: string
          actor_id: string | null
          actor_user_id: string | null
          changed: Json
          at: string
        }
        Insert: {
          id?: number
          community_id: string
          table_name: string
          row_id: string
          action: string
          actor_id?: string | null
          actor_user_id?: string | null
          changed?: Json
          at?: string
        }
        Update: {
          id?: number
          community_id?: string
          table_name?: string
          row_id?: string
          action?: string
          actor_id?: string | null
          actor_user_id?: string | null
          changed?: Json
          at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          community_id: string | null
          actor_user_id: string | null
          actor_api_key: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          channel: Database["public"]["Enums"]["origin_channel"]
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          community_id?: string | null
          actor_user_id?: string | null
          actor_api_key?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string | null
          actor_user_id?: string | null
          actor_api_key?: string | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_api_key_fkey"
            columns: ["actor_api_key"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          }
        ]
      }
      bank_accounts: {
        Row: {
          id: string
          community_id: string
          label: string
          bank_name: string | null
          last4: string | null
          currency: string
          is_active: boolean
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          community_id: string
          label: string
          bank_name?: string | null
          last4?: string | null
          currency?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          community_id?: string
          label?: string
          bank_name?: string | null
          last4?: string | null
          currency?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      bank_transactions: {
        Row: {
          id: string
          community_id: string
          account_id: string
          posted_on: string
          amount: number
          narration: string | null
          reference: string | null
          counterparty: string | null
          balance_after: number | null
          source: Database["public"]["Enums"]["bank_line_source"]
          external_id: string
          contribution_id: string | null
          expense_id: string | null
          matched_by: string | null
          matched_at: string | null
          ignored_reason: string | null
          imported_at: string
          imported_by: string | null
        }
        Insert: {
          id?: string
          community_id: string
          account_id: string
          posted_on: string
          amount: number
          narration?: string | null
          reference?: string | null
          counterparty?: string | null
          balance_after?: number | null
          source?: Database["public"]["Enums"]["bank_line_source"]
          external_id: string
          contribution_id?: string | null
          expense_id?: string | null
          matched_by?: string | null
          matched_at?: string | null
          ignored_reason?: string | null
          imported_at?: string
          imported_by?: string | null
        }
        Update: {
          id?: string
          community_id?: string
          account_id?: string
          posted_on?: string
          amount?: number
          narration?: string | null
          reference?: string | null
          counterparty?: string | null
          balance_after?: number | null
          source?: Database["public"]["Enums"]["bank_line_source"]
          external_id?: string
          contribution_id?: string | null
          expense_id?: string | null
          matched_by?: string | null
          matched_at?: string | null
          ignored_reason?: string | null
          imported_at?: string
          imported_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      budget_lines: {
        Row: {
          id: string
          event_id: string
          community_id: string
          category: string
          amount: number
          notes: string | null
          position: number
          created_at: string
          category_id: string | null
          vendor: string | null
          vendor_id: string | null
        }
        Insert: {
          id?: string
          event_id: string
          community_id: string
          category: string
          amount: number
          notes?: string | null
          position?: number
          created_at?: string
          category_id?: string | null
          vendor?: string | null
          vendor_id?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          community_id?: string
          category?: string
          amount?: number
          notes?: string | null
          position?: number
          created_at?: string
          category_id?: string | null
          vendor?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          }
        ]
      }
      catalogue_items: {
        Row: {
          id: string
          community_id: string
          kind: string
          label: string
          emoji: string | null
          details: Json
          position: number
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          kind: string
          label: string
          emoji?: string | null
          details?: Json
          position?: number
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          kind?: string
          label?: string
          emoji?: string | null
          details?: Json
          position?: number
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_items_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogue_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          community_id: string
          membership_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          comment_id: string
          community_id: string
          membership_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          comment_id?: string
          community_id?: string
          membership_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      comments: {
        Row: {
          id: string
          community_id: string
          event_id: string | null
          suggestion_id: string | null
          membership_id: string
          body: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          event_id?: string | null
          suggestion_id?: string | null
          membership_id: string
          body: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          event_id?: string | null
          suggestion_id?: string | null
          membership_id?: string
          body?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "activity_suggestions"
            referencedColumns: ["id"]
          }
        ]
      }
      communities: {
        Row: {
          id: string
          slug: string
          join_code: string
          name: string
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          country: string
          timezone: string
          currency: string
          logo_url: string | null
          settings: Json
          created_by: string | null
          created_at: string
          updated_at: string
          restrict_spending_approval: boolean
          upi_vpa: string | null
          upi_payee_name: string | null
          address: string | null
          pincode: string | null
          setup_completed_at: string | null
          catalogue_reviewed_at: string | null
          whatsapp_group_url: string | null
        }
        Insert: {
          id?: string
          slug: string
          join_code?: string
          name: string
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string
          timezone?: string
          currency?: string
          logo_url?: string | null
          settings?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
          restrict_spending_approval?: boolean
          upi_vpa?: string | null
          upi_payee_name?: string | null
          address?: string | null
          pincode?: string | null
          setup_completed_at?: string | null
          catalogue_reviewed_at?: string | null
          whatsapp_group_url?: string | null
        }
        Update: {
          id?: string
          slug?: string
          join_code?: string
          name?: string
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string
          timezone?: string
          currency?: string
          logo_url?: string | null
          settings?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
          restrict_spending_approval?: boolean
          upi_vpa?: string | null
          upi_payee_name?: string | null
          address?: string | null
          pincode?: string | null
          setup_completed_at?: string | null
          catalogue_reviewed_at?: string | null
          whatsapp_group_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      contributions: {
        Row: {
          id: string
          event_id: string
          community_id: string
          membership_id: string | null
          unit_id: string | null
          amount: number
          currency: string
          method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["contribution_status"]
          receipt_no: number
          reference: string | null
          gateway_payload: Json
          channel: Database["public"]["Enums"]["origin_channel"]
          paid_at: string
          created_at: string
          proof_path: string | null
          verified_by: string | null
          verified_at: string | null
          review_note: string | null
          updated_at: string
          updated_by: string | null
          reported_amount: number | null
        }
        Insert: {
          id?: string
          event_id: string
          community_id: string
          membership_id?: string | null
          unit_id?: string | null
          amount: number
          currency?: string
          method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["contribution_status"]
          receipt_no?: number
          reference?: string | null
          gateway_payload?: Json
          channel?: Database["public"]["Enums"]["origin_channel"]
          paid_at?: string
          created_at?: string
          proof_path?: string | null
          verified_by?: string | null
          verified_at?: string | null
          review_note?: string | null
          updated_at?: string
          updated_by?: string | null
          reported_amount?: number | null
        }
        Update: {
          id?: string
          event_id?: string
          community_id?: string
          membership_id?: string | null
          unit_id?: string | null
          amount?: number
          currency?: string
          method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["contribution_status"]
          receipt_no?: number
          reference?: string | null
          gateway_payload?: Json
          channel?: Database["public"]["Enums"]["origin_channel"]
          paid_at?: string
          created_at?: string
          proof_path?: string | null
          verified_by?: string | null
          verified_at?: string | null
          review_note?: string | null
          updated_at?: string
          updated_by?: string | null
          reported_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      device_push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          platform: string
          app_version: string | null
          last_seen_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          platform: string
          app_version?: string | null
          last_seen_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          platform?: string
          app_version?: string | null
          last_seen_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      event_activities: {
        Row: {
          id: string
          event_id: string
          community_id: string
          name: string
          emoji: string
          description: string | null
          coordinator_id: string | null
          practice_dates: string[]
          capacity: number | null
          is_open: boolean
          position: number
          created_at: string
          updated_at: string
          activity_type_id: string | null
        }
        Insert: {
          id?: string
          event_id: string
          community_id: string
          name: string
          emoji?: string
          description?: string | null
          coordinator_id?: string | null
          practice_dates?: string[]
          capacity?: number | null
          is_open?: boolean
          position?: number
          created_at?: string
          updated_at?: string
          activity_type_id?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          community_id?: string
          name?: string
          emoji?: string
          description?: string | null
          coordinator_id?: string | null
          practice_dates?: string[]
          capacity?: number | null
          is_open?: boolean
          position?: number
          created_at?: string
          updated_at?: string
          activity_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_activities_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_activities_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_activities_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_activities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      event_tasks: {
        Row: {
          id: string
          event_id: string
          community_id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["task_status"]
          assignee_id: string | null
          due_on: string | null
          position: number
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          community_id: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          assignee_id?: string | null
          due_on?: string | null
          position?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          community_id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          assignee_id?: string | null
          due_on?: string | null
          position?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasks_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      event_volunteers: {
        Row: {
          id: string
          role_id: string
          membership_id: string
          note: string | null
          channel: Database["public"]["Enums"]["origin_channel"]
          signed_up_at: string
        }
        Insert: {
          id?: string
          role_id: string
          membership_id: string
          note?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          signed_up_at?: string
        }
        Update: {
          id?: string
          role_id?: string
          membership_id?: string
          note?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          signed_up_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_volunteers_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_volunteers_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "volunteer_roles"
            referencedColumns: ["id"]
          }
        ]
      }
      events: {
        Row: {
          id: string
          community_id: string
          slug: string
          emoji: string
          name: string
          starts_on: string
          ends_on: string | null
          venue: string | null
          organizer: string | null
          description: string | null
          status: Database["public"]["Enums"]["event_status"]
          expected_attendance: number | null
          fund_target: number
          fund_rule: Database["public"]["Enums"]["fund_rule"]
          fund_rule_note: string | null
          published_at: string | null
          closed_at: string | null
          closing_summary: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
          kind: string
          event_type_id: string | null
          venue_id: string | null
          whatsapp_group_url: string | null
          updated_by: string | null
          suggested_amount: number | null
        }
        Insert: {
          id?: string
          community_id: string
          slug: string
          emoji?: string
          name: string
          starts_on: string
          ends_on?: string | null
          venue?: string | null
          organizer?: string | null
          description?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          expected_attendance?: number | null
          fund_target?: number
          fund_rule?: Database["public"]["Enums"]["fund_rule"]
          fund_rule_note?: string | null
          published_at?: string | null
          closed_at?: string | null
          closing_summary?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          kind?: string
          event_type_id?: string | null
          venue_id?: string | null
          whatsapp_group_url?: string | null
          updated_by?: string | null
          suggested_amount?: number | null
        }
        Update: {
          id?: string
          community_id?: string
          slug?: string
          emoji?: string
          name?: string
          starts_on?: string
          ends_on?: string | null
          venue?: string | null
          organizer?: string | null
          description?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          expected_attendance?: number | null
          fund_target?: number
          fund_rule?: Database["public"]["Enums"]["fund_rule"]
          fund_rule_note?: string | null
          published_at?: string | null
          closed_at?: string | null
          closing_summary?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          kind?: string
          event_type_id?: string | null
          venue_id?: string | null
          whatsapp_group_url?: string | null
          updated_by?: string | null
          suggested_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          }
        ]
      }
      expenses: {
        Row: {
          id: string
          event_id: string
          community_id: string
          name: string
          category: string | null
          amount: number
          currency: string
          vendor: string | null
          paid_by: string | null
          method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["expense_status"]
          bill_url: string | null
          requested_by: string | null
          approved_by: string | null
          approved_at: string | null
          review_note: string | null
          spent_on: string
          created_at: string
          updated_at: string
          vendor_id: string | null
          category_id: string | null
          updated_by: string | null
          revised_by: string | null
          revised_at: string | null
          budget_line_id: string | null
        }
        Insert: {
          id?: string
          event_id: string
          community_id: string
          name: string
          category?: string | null
          amount: number
          currency?: string
          vendor?: string | null
          paid_by?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["expense_status"]
          bill_url?: string | null
          requested_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          review_note?: string | null
          spent_on?: string
          created_at?: string
          updated_at?: string
          vendor_id?: string | null
          category_id?: string | null
          updated_by?: string | null
          revised_by?: string | null
          revised_at?: string | null
          budget_line_id?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          community_id?: string
          name?: string
          category?: string | null
          amount?: number
          currency?: string
          vendor?: string | null
          paid_by?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["expense_status"]
          bill_url?: string | null
          requested_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          review_note?: string | null
          spent_on?: string
          created_at?: string
          updated_at?: string
          vendor_id?: string | null
          category_id?: string | null
          updated_by?: string | null
          revised_by?: string | null
          revised_at?: string | null
          budget_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_revised_by_fkey"
            columns: ["revised_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          }
        ]
      }
      fund_movements: {
        Row: {
          id: string
          community_id: string
          kind: Database["public"]["Enums"]["fund_movement_kind"]
          from_event_id: string | null
          to_event_id: string | null
          amount: number
          note: string | null
          decided_by: string | null
          decided_at: string
          created_at: string
          paid_to: string | null
          proof_path: string | null
        }
        Insert: {
          id?: string
          community_id: string
          kind: Database["public"]["Enums"]["fund_movement_kind"]
          from_event_id?: string | null
          to_event_id?: string | null
          amount: number
          note?: string | null
          decided_by?: string | null
          decided_at?: string
          created_at?: string
          paid_to?: string | null
          proof_path?: string | null
        }
        Update: {
          id?: string
          community_id?: string
          kind?: Database["public"]["Enums"]["fund_movement_kind"]
          from_event_id?: string | null
          to_event_id?: string | null
          amount?: number
          note?: string | null
          decided_by?: string | null
          decided_at?: string
          created_at?: string
          paid_to?: string | null
          proof_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fund_movements_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_movements_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_movements_from_event_id_fkey"
            columns: ["from_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_movements_to_event_id_fkey"
            columns: ["to_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      invite_code_attempts: {
        Row: {
          id: string
          user_id: string | null
          code_tried: string
          succeeded: boolean
          channel: Database["public"]["Enums"]["origin_channel"]
          attempted_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          code_tried: string
          succeeded?: boolean
          channel?: Database["public"]["Enums"]["origin_channel"]
          attempted_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          code_tried?: string
          succeeded?: boolean
          channel?: Database["public"]["Enums"]["origin_channel"]
          attempted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_code_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      invite_code_redemptions: {
        Row: {
          id: string
          invite_code_id: string
          user_id: string
          membership_id: string | null
          channel: Database["public"]["Enums"]["origin_channel"]
          redeemed_at: string
        }
        Insert: {
          id?: string
          invite_code_id: string
          user_id: string
          membership_id?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          redeemed_at?: string
        }
        Update: {
          id?: string
          invite_code_id?: string
          user_id?: string
          membership_id?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_code_redemptions_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_code_redemptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_code_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      invite_codes: {
        Row: {
          id: string
          community_id: string
          code: string
          label: string | null
          role: Database["public"]["Enums"]["member_role"]
          unit_id: string | null
          relation: Database["public"]["Enums"]["occupant_relation"]
          max_uses: number | null
          used_count: number
          expires_at: string | null
          revoked_at: string | null
          revoked_by: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          code: string
          label?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          unit_id?: string | null
          relation?: Database["public"]["Enums"]["occupant_relation"]
          max_uses?: number | null
          used_count?: number
          expires_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          code?: string
          label?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          unit_id?: string | null
          relation?: Database["public"]["Enums"]["occupant_relation"]
          max_uses?: number | null
          used_count?: number
          expires_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      join_requests: {
        Row: {
          id: string
          community_id: string
          user_id: string
          unit_id: string | null
          claimed_name: string
          claimed_phone: string | null
          relation: Database["public"]["Enums"]["occupant_relation"]
          status: Database["public"]["Enums"]["join_request_status"]
          reviewed_by: string | null
          reviewed_at: string | null
          decline_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          unit_id?: string | null
          claimed_name: string
          claimed_phone?: string | null
          relation?: Database["public"]["Enums"]["occupant_relation"]
          status?: Database["public"]["Enums"]["join_request_status"]
          reviewed_by?: string | null
          reviewed_at?: string | null
          decline_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          unit_id?: string | null
          claimed_name?: string
          claimed_phone?: string | null
          relation?: Database["public"]["Enums"]["occupant_relation"]
          status?: Database["public"]["Enums"]["join_request_status"]
          reviewed_by?: string | null
          reviewed_at?: string | null
          decline_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      memberships: {
        Row: {
          id: string
          community_id: string
          user_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["membership_status"]
          invited_via: string | null
          joined_at: string
          created_at: string
          updated_at: string
          title: string | null
          approves_spending: boolean
          welcomed_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          invited_via?: string | null
          joined_at?: string
          created_at?: string
          updated_at?: string
          title?: string | null
          approves_spending?: boolean
          welcomed_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          invited_via?: string | null
          joined_at?: string
          created_at?: string
          updated_at?: string
          title?: string | null
          approves_spending?: boolean
          welcomed_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_invited_via_fkey"
            columns: ["invited_via"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          community_id: string | null
          user_id: string
          kind: string
          title: string
          body: string | null
          data: Json
          read_at: string | null
          created_at: string
          pushed_at: string | null
          push_error: string | null
        }
        Insert: {
          id?: string
          community_id?: string | null
          user_id: string
          kind: string
          title: string
          body?: string | null
          data?: Json
          read_at?: string | null
          created_at?: string
          pushed_at?: string | null
          push_error?: string | null
        }
        Update: {
          id?: string
          community_id?: string | null
          user_id?: string
          kind?: string
          title?: string
          body?: string | null
          data?: Json
          read_at?: string | null
          created_at?: string
          pushed_at?: string | null
          push_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      poll_options: {
        Row: {
          id: string
          poll_id: string
          label: string
          emoji: string | null
          position: number
        }
        Insert: {
          id?: string
          poll_id: string
          label: string
          emoji?: string | null
          position?: number
        }
        Update: {
          id?: string
          poll_id?: string
          label?: string
          emoji?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          }
        ]
      }
      poll_votes: {
        Row: {
          id: string
          poll_id: string
          option_id: string
          membership_id: string
          channel: Database["public"]["Enums"]["origin_channel"]
          voted_at: string
        }
        Insert: {
          id?: string
          poll_id: string
          option_id: string
          membership_id: string
          channel?: Database["public"]["Enums"]["origin_channel"]
          voted_at?: string
        }
        Update: {
          id?: string
          poll_id?: string
          option_id?: string
          membership_id?: string
          channel?: Database["public"]["Enums"]["origin_channel"]
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          }
        ]
      }
      polls: {
        Row: {
          id: string
          community_id: string
          event_id: string | null
          question: string
          detail: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          closes_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          event_id?: string | null
          question: string
          detail?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          closes_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          event_id?: string | null
          question?: string
          detail?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          closes_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          avatar_url: string | null
          locale: string
          is_platform_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          locale?: string
          is_platform_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          locale?: string
          is_platform_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      society_expenses: {
        Row: {
          id: string
          community_id: string
          amount: number
          reason: string
          paid_to: string
          proof_path: string
          spent_on: string
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          amount: number
          reason: string
          paid_to: string
          proof_path: string
          spent_on?: string
          recorded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          amount?: number
          reason?: string
          paid_to?: string
          proof_path?: string
          spent_on?: string
          recorded_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "society_expenses_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "society_expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      suggestion_interests: {
        Row: {
          suggestion_id: string
          membership_id: string
          created_at: string
        }
        Insert: {
          suggestion_id: string
          membership_id: string
          created_at?: string
        }
        Update: {
          suggestion_id?: string
          membership_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_interests_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_interests_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "activity_suggestions"
            referencedColumns: ["id"]
          }
        ]
      }
      suggestion_votes: {
        Row: {
          id: string
          suggestion_id: string
          membership_id: string
          support: boolean
          voted_at: string
        }
        Insert: {
          id?: string
          suggestion_id: string
          membership_id: string
          support: boolean
          voted_at?: string
        }
        Update: {
          id?: string
          suggestion_id?: string
          membership_id?: string
          support?: boolean
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_votes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "activity_suggestions"
            referencedColumns: ["id"]
          }
        ]
      }
      unit_change_requests: {
        Row: {
          id: string
          community_id: string
          membership_id: string
          unit_id: string | null
          note: string | null
          status: Database["public"]["Enums"]["join_request_status"]
          reviewed_by: string | null
          reviewed_at: string | null
          decline_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          membership_id: string
          unit_id?: string | null
          note?: string | null
          status?: Database["public"]["Enums"]["join_request_status"]
          reviewed_by?: string | null
          reviewed_at?: string | null
          decline_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          membership_id?: string
          unit_id?: string | null
          note?: string | null
          status?: Database["public"]["Enums"]["join_request_status"]
          reviewed_by?: string | null
          reviewed_at?: string | null
          decline_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_change_requests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_change_requests_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_change_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      unit_occupants: {
        Row: {
          id: string
          unit_id: string
          membership_id: string
          relation: Database["public"]["Enums"]["occupant_relation"]
          is_primary: boolean
          moved_in_on: string | null
          moved_out_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          unit_id: string
          membership_id: string
          relation?: Database["public"]["Enums"]["occupant_relation"]
          is_primary?: boolean
          moved_in_on?: string | null
          moved_out_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          unit_id?: string
          membership_id?: string
          relation?: Database["public"]["Enums"]["occupant_relation"]
          is_primary?: boolean
          moved_in_on?: string | null
          moved_out_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_occupants_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_occupants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      units: {
        Row: {
          id: string
          community_id: string
          block: string | null
          number: string
          floor: number | null
          bedrooms: number | null
          area_sqft: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          block?: string | null
          number: string
          floor?: number | null
          bedrooms?: number | null
          area_sqft?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          block?: string | null
          number?: string
          floor?: number | null
          bedrooms?: number | null
          area_sqft?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          }
        ]
      }
      volunteer_roles: {
        Row: {
          id: string
          event_id: string
          community_id: string
          name: string
          emoji: string
          description: string | null
          target_count: number
          coordinator_id: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          community_id: string
          name: string
          emoji?: string
          description?: string | null
          target_count?: number
          coordinator_id?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          community_id?: string
          name?: string
          emoji?: string
          description?: string | null
          target_count?: number
          coordinator_id?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_roles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_roles_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      whatsapp_link_codes: {
        Row: {
          id: string
          code: string
          user_id: string
          community_id: string | null
          expires_at: string
          consumed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          user_id: string
          community_id?: string | null
          expires_at?: string
          consumed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          user_id?: string
          community_id?: string | null
          expires_at?: string
          consumed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_link_codes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_link_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      whatsapp_links: {
        Row: {
          id: string
          phone: string
          user_id: string
          default_community_id: string | null
          verified_at: string | null
          opted_out_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone: string
          user_id: string
          default_community_id?: string | null
          verified_at?: string | null
          opted_out_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string
          user_id?: string
          default_community_id?: string | null
          verified_at?: string | null
          opted_out_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_links_default_community_id_fkey"
            columns: ["default_community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      whatsapp_messages: {
        Row: {
          id: string
          wa_message_id: string | null
          direction: string
          phone: string
          community_id: string | null
          user_id: string | null
          body: string | null
          payload: Json
          status: string
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          wa_message_id?: string | null
          direction: string
          phone: string
          community_id?: string | null
          user_id?: string | null
          body?: string | null
          payload?: Json
          status?: string
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          wa_message_id?: string | null
          direction?: string
          phone?: string
          community_id?: string | null
          user_id?: string | null
          body?: string | null
          payload?: Json
          status?: string
          error?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      activity_stats: {
        Row: {
          activity_id: string | null
          event_id: string | null
          community_id: string | null
          interested: number | null
        }
        Relationships: [

        ]
      }
      budget_line_balances: {
        Row: {
          id: string | null
          event_id: string | null
          community_id: string | null
          category: string | null
          vendor: string | null
          planned: number | null
          approved: number | null
          pending: number | null
          remaining: number | null
          position: number | null
        }
        Relationships: [

        ]
      }
      event_stats: {
        Row: {
          event_id: string | null
          community_id: string | null
          fund_target: number | null
          fund_raised: number | null
          contributors: number | null
          spent: number | null
          available: number | null
          pending_expenses: number | null
          tasks_total: number | null
          tasks_done: number | null
          readiness: number | null
          participants: number | null
          volunteers: number | null
          fund_pending: number | null
          pending_contributors: number | null
          fund_carried: number | null
          fund_carried_in: number | null
          fund_moved_out: number | null
        }
        Relationships: [

        ]
      }
      poll_results: {
        Row: {
          poll_id: string | null
          option_id: string | null
          label: string | null
          emoji: string | null
          position: number | null
          votes: number | null
          total_votes: number | null
        }
        Relationships: [

        ]
      }
      reconciliation_summary: {
        Row: {
          community_id: string | null
          unexplained_lines: number | null
          unexplained_in: number | null
          unexplained_out: number | null
          last_line_on: string | null
        }
        Relationships: [

        ]
      }
      society_balance: {
        Row: {
          community_id: string | null
          balance: number | null
          movements_in: number | null
          last_decided_at: string | null
        }
        Relationships: [

        ]
      }
      society_ledger: {
        Row: {
          id: string | null
          community_id: string | null
          event_id: string | null
          event_slug: string | null
          event_name: string | null
          direction: string | null
          happened_at: string | null
          amount: number | null
          counterpart: string | null
          detail: string | null
          receipt_no: number | null
          document_url: string | null
          confirmed_by: string | null
          confirmed_at: string | null
          membership_id: string | null
          payer_name: string | null
          unit_label: string | null
          method: string | null
          kind: string | null
        }
        Relationships: [

        ]
      }
      society_money: {
        Row: {
          community_id: string | null
          total_in: number | null
          total_out: number | null
          balance: number | null
          payments_in: number | null
          payments_out: number | null
          last_movement_at: string | null
        }
        Relationships: [

        ]
      }
      suggestion_stats: {
        Row: {
          suggestion_id: string | null
          community_id: string | null
          interested: number | null
          votes_for: number | null
          votes_against: number | null
        }
        Relationships: [

        ]
      }
      volunteer_role_stats: {
        Row: {
          role_id: string | null
          event_id: string | null
          community_id: string | null
          target_count: number | null
          signed_up: number | null
          still_needed: number | null
        }
        Relationships: [

        ]
      }
    }
    Functions: {
      allocate_surplus: {
        Args: {
        p_event_id: string
        p_kind: Database["public"]["Enums"]["fund_movement_kind"]
        p_to_event_id?: string
        p_note?: string
      }
        Returns: Database["public"]["Tables"]["fund_movements"]["Row"]
      }
      bank_line_candidates: {
        Args: {
        p_transaction_id: string
      }
        Returns: {
        contribution_id: string | null
        payer: string | null
        amount: number | null
        reported_on: string | null
        reference: string | null
        confidence: string | null
      }[]
      }
      close_suggestion_vote: {
        Args: {
        p_suggestion_id: string
        p_adopt?: boolean
      }
        Returns: Database["public"]["Tables"]["activity_suggestions"]["Row"]
      }
      cover_overspend: {
        Args: {
        p_event_id: string
        p_amount: number
        p_paid_to: string
        p_proof_path: string
        p_note?: string
      }
        Returns: Database["public"]["Tables"]["fund_movements"]["Row"]
      }
      create_invite_code: {
        Args: {
        p_community_id: string
        p_role?: Database["public"]["Enums"]["member_role"]
        p_unit_id?: string
        p_relation?: Database["public"]["Enums"]["occupant_relation"]
        p_max_uses?: number
        p_expires_at?: string
        p_label?: string
      }
        Returns: Database["public"]["Tables"]["invite_codes"]["Row"]
      }
      create_society: {
        Args: {
        p_name: string
        p_city?: string
        p_address?: string
        p_pincode?: string
        p_phone?: string
        p_flat?: string
      }
        Returns: {
        status: string | null
        community_id: string | null
        slug: string | null
        join_code: string | null
      }[]
      }
      create_whatsapp_link_code: {
        Args: {
        p_community_id?: string
      }
        Returns: Database["public"]["Tables"]["whatsapp_link_codes"]["Row"]
      }
      delete_my_account: {
        Args: { [_ in never]: never }
        Returns: {
        status: string | null
        detail: string | null
      }[]
      }
      ignore_bank_line: {
        Args: {
        p_transaction_id: string
        p_reason: string
      }
        Returns: undefined
      }
      import_bank_lines: {
        Args: {
        p_account_id: string
        p_lines: Json
      }
        Returns: number
      }
      join_request_contacts: {
        Args: {
        p_community_id: string
      }
        Returns: {
        request_id: string | null
        email: string | null
      }[]
      }
      mark_notifications_read: {
        Args: {
        p_ids?: string[]
      }
        Returns: undefined
      }
      mark_welcomed: {
        Args: {
        p_community_id: string
      }
        Returns: undefined
      }
      member_history: {
        Args: {
        p_membership_id: string
      }
        Returns: {
        kind: string | null
        happened_at: string | null
        title: string | null
        detail: string | null
        amount: number | null
        status: string | null
        event_slug: string | null
        event_name: string | null
      }[]
      }
      my_contact: {
        Args: { [_ in never]: never }
        Returns: {
        email: string | null
        phone: string | null
      }[]
      }
      normalize_invite_code: {
        Args: {
        p_code: string
      }
        Returns: string
      }
      preview_invite_code: {
        Args: {
        p_code: string
      }
        Returns: {
        status: string | null
        community_name: string | null
        community_slug: string | null
        role: Database["public"]["Enums"]["member_role"] | null
        unit_label: string | null
        expires_at: string | null
      }[]
      }
      reconcile_bank_line: {
        Args: {
        p_transaction_id: string
        p_contribution_id: string
        p_take_bank_amount?: boolean
      }
        Returns: Database["public"]["Tables"]["contributions"]["Row"]
      }
      record_society_expense: {
        Args: {
        p_community_id: string
        p_amount: number
        p_reason: string
        p_paid_to: string
        p_proof_path: string
        p_spent_on?: string
      }
        Returns: Database["public"]["Tables"]["society_expenses"]["Row"]
      }
      redeem_invite_code: {
        Args: {
        p_code: string
        p_channel?: Database["public"]["Enums"]["origin_channel"]
      }
        Returns: {
        status: string | null
        membership_id: string | null
        community_id: string | null
        community_name: string | null
        community_slug: string | null
        role: Database["public"]["Enums"]["member_role"] | null
        unit_id: string | null
      }[]
      }
      request_to_join: {
        Args: {
        p_join_code: string
        p_unit_id?: string
        p_name?: string
        p_phone?: string
        p_relation?: Database["public"]["Enums"]["occupant_relation"]
      }
        Returns: {
        status: string | null
        request_id: string | null
        community_id: string | null
        community_name: string | null
      }[]
      }
      request_unit_change: {
        Args: {
        p_community_id: string
        p_unit_id?: string
        p_note?: string
      }
        Returns: string
      }
      review_contribution: {
        Args: {
        p_contribution_id: string
        p_confirm: boolean
        p_note?: string
        p_reference?: string
        p_amount?: number
      }
        Returns: Database["public"]["Tables"]["contributions"]["Row"]
      }
      review_expense: {
        Args: {
        p_expense_id: string
        p_decision: Database["public"]["Enums"]["expense_status"]
        p_note?: string
      }
        Returns: Database["public"]["Tables"]["expenses"]["Row"]
      }
      review_join_request: {
        Args: {
        p_request_id: string
        p_approve: boolean
        p_role?: Database["public"]["Enums"]["member_role"]
        p_reason?: string
      }
        Returns: Database["public"]["Tables"]["join_requests"]["Row"]
      }
      review_unit_change: {
        Args: {
        p_request_id: string
        p_approve: boolean
        p_reason?: string
      }
        Returns: string
      }
      set_member_unit: {
        Args: {
        p_membership_id: string
        p_unit_id?: string
      }
        Returns: string
      }
      society_people: {
        Args: {
        p_community_id: string
      }
        Returns: {
        membership_id: string | null
        user_id: string | null
        full_name: string | null
        role: Database["public"]["Enums"]["member_role"] | null
        flat: string | null
        relation: Database["public"]["Enums"]["occupant_relation"] | null
        joined_at: string | null
        email: string | null
        phone: string | null
      }[]
      }
      society_units: {
        Args: {
        p_join_code: string
      }
        Returns: {
        id: string | null
        block: string | null
        number: string | null
      }[]
      }
      spend_society_balance: {
        Args: {
        p_to_event_id: string
        p_amount: number
        p_note?: string
      }
        Returns: Database["public"]["Tables"]["fund_movements"]["Row"]
      }
      todo_count: {
        Args: {
        p_community_id: string
      }
        Returns: number
      }
      todo_items: {
        Args: {
        p_community_id: string
      }
        Returns: {
        kind: string | null
        id: string | null
        title: string | null
        subtitle: string | null
        amount: number | null
        event_slug: string | null
        event_name: string | null
        created_at: string | null
      }[]
      }
      unreconcile_bank_line: {
        Args: {
        p_transaction_id: string
      }
        Returns: undefined
      }
      verify_api_key: {
        Args: {
        p_prefix: string
        p_hash: string
      }
        Returns: {
        api_key_id: string | null
        community_id: string | null
        scopes: string[] | null
        acts_as: string | null
      }[]
      }
    }
    Enums: {
      announcement_audience: "all" | "residents" | "committee"
      bank_line_source: "import" | "feed" | "manual"
      contribution_status: "pending" | "succeeded" | "failed" | "refunded"
      event_status: "proposed" | "draft" | "published" | "completed" | "cancelled"
      expense_status: "pending" | "approved" | "rejected" | "changes_requested"
      fund_movement_kind: "next_event" | "next_edition" | "society_balance" | "from_balance"
      fund_rule: "carry_next_edition" | "carry_related" | "general_fund" | "refund" | "donate"
      join_request_status: "pending" | "approved" | "rejected"
      member_role: "resident" | "staff" | "admin" | "committee"
      membership_status: "pending" | "active" | "suspended"
      occupant_relation: "owner" | "tenant" | "family" | "other"
      origin_channel: "web" | "mobile" | "whatsapp" | "api" | "system"
      payment_method: "upi" | "card" | "netbanking" | "bank_transfer" | "cash" | "cheque" | "other"
      proposal_status: "voting" | "approved" | "rejected" | "withdrawn"
      suggestion_status: "new" | "reviewing" | "accepted" | "declined" | "adopted" | "not_adopted"
      task_status: "todo" | "in_progress" | "done" | "blocked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public'];

export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never;

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Insert: infer I } ? I : never;

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Update: infer U } ? U : never;

export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export type FunctionArgs<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Args'];

export type FunctionReturns<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Returns'];
