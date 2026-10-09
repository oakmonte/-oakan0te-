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
      buyer_addresses: {
        Row: {
          address_input: string
          city: string | null
          created_at: string
          formatted_address: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          phone: string
          postal_code: string | null
          shipbubble_address_code: number | null
          state: string | null
          user_id: string
        }
        Insert: {
          address_input: string
          city?: string | null
          created_at?: string
          formatted_address?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          phone: string
          postal_code?: string | null
          shipbubble_address_code?: number | null
          state?: string | null
          user_id: string
        }
        Update: {
          address_input?: string
          city?: string | null
          created_at?: string
          formatted_address?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string
          postal_code?: string | null
          shipbubble_address_code?: number | null
          state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          additional_image_urls: string[] | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          status: string
          store_id: string
          title: string
        }
        Insert: {
          additional_image_urls?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          status?: string
          store_id: string
          title: string
        }
        Update: {
          additional_image_urls?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          status?: string
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          archived_at: string | null
          cleared_at: string | null
          conversation_id: string
          joined_at: string
          last_active_at: string | null
          last_delivered_at: string
          last_read_at: string
          marked_unread: boolean
          muted: boolean
          pinned_at: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          cleared_at?: string | null
          conversation_id: string
          joined_at?: string
          last_active_at?: string | null
          last_delivered_at?: string
          last_read_at?: string
          marked_unread?: boolean
          muted?: boolean
          pinned_at?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          cleared_at?: string | null
          conversation_id?: string
          joined_at?: string
          last_active_at?: string | null
          last_delivered_at?: string
          last_read_at?: string
          marked_unread?: boolean
          muted?: boolean
          pinned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_presence: {
        Row: {
          active_at: string | null
          conversation_id: string
          delivered_at: string
          user_id: string
        }
        Insert: {
          active_at?: string | null
          conversation_id: string
          delivered_at?: string
          user_id: string
        }
        Update: {
          active_at?: string | null
          conversation_id?: string
          delivered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_presence_conversation_id_user_id_fkey"
            columns: ["conversation_id", "user_id"]
            isOneToOne: true
            referencedRelation: "conversation_members"
            referencedColumns: ["conversation_id", "user_id"]
          },
        ]
      }
      conversation_read_receipts: {
        Row: {
          conversation_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_read_receipts_conversation_id_user_id_fkey"
            columns: ["conversation_id", "user_id"]
            isOneToOne: true
            referencedRelation: "conversation_members"
            referencedColumns: ["conversation_id", "user_id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          kind: string
          last_message_at: string
          pair_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          last_message_at?: string
          pair_key: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          last_message_at?: string
          pair_key?: string
        }
        Relationships: []
      }
      creators: {
        Row: {
          created_at: string
          id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creators_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creators_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creators_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curators: {
        Row: {
          created_at: string
          id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curators_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curators_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curators_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_collections: {
        Row: {
          collection_id: string
          created_at: string
          drop_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          drop_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          drop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_collections_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_products: {
        Row: {
          created_at: string
          drop_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          drop_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          drop_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_products_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      drops: {
        Row: {
          collection_id: string | null
          cover_image_url: string | null
          created_at: string
          ends_at: string | null
          id: string
          starts_at: string | null
          store_id: string
          title: string
        }
        Insert: {
          collection_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          store_id: string
          title: string
        }
        Update: {
          collection_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "drops_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drops_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fit_profiles: {
        Row: {
          body_type: string | null
          created_at: string
          full_body_photo_url: string | null
          gender: string | null
          height_cm: number | null
          id: string
          measurements_cm: Json | null
          owner_id: string
          styles: string[] | null
          weight_kg: number | null
        }
        Insert: {
          body_type?: string | null
          created_at?: string
          full_body_photo_url?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          measurements_cm?: Json | null
          owner_id: string
          styles?: string[] | null
          weight_kg?: number | null
        }
        Update: {
          body_type?: string | null
          created_at?: string
          full_body_photo_url?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          measurements_cm?: Json | null
          owner_id?: string
          styles?: string[] | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fit_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fit_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fit_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_post_files: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          media_type: string | null
          position: number | null
          post_id: string | null
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          media_type?: string | null
          position?: number | null
          post_id?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          media_type?: string | null
          position?: number | null
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ig_post_files_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "ig_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_posts: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          media_type: string
          permalink: string | null
          seller_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id: string
          media_type: string
          permalink?: string | null
          seller_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          media_type?: string
          permalink?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_posts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          error: string | null
          file_path: string | null
          heartbeat_at: string | null
          id: string
          metadata: Json
          platform: string
          result: Json | null
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          file_path?: string | null
          heartbeat_at?: string | null
          id?: string
          metadata?: Json
          platform: string
          result?: Json | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          file_path?: string | null
          heartbeat_at?: string | null
          id?: string
          metadata?: Json
          platform?: string
          result?: Json | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      message_hides: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_hides_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_hides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_hides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_hides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          conversation_id: string
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reports: {
        Row: {
          conversation_id: string
          created_at: string
          details: string | null
          id: string
          message_id: string | null
          reason: string
          reporter_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason: string
          reporter_id?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          forwarded: boolean
          id: string
          kind: string
          media_meta: Json | null
          media_path: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          forwarded?: boolean
          id?: string
          kind?: string
          media_meta?: Json | null
          media_path?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          forwarded?: boolean
          id?: string
          kind?: string
          media_meta?: Json | null
          media_path?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_settings: {
        Row: {
          read_receipts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          read_receipts?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          read_receipts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaging_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          image_url: string | null
          order_id: string
          product_id: string | null
          quantity: number
          title: string
          unit_price_kobo: number
          variant_id: string | null
          variant_label: string | null
          weight_grams: number | null
        }
        Insert: {
          id?: string
          image_url?: string | null
          order_id: string
          product_id?: string | null
          quantity: number
          title: string
          unit_price_kobo: number
          variant_id?: string | null
          variant_label?: string | null
          weight_grams?: number | null
        }
        Update: {
          id?: string
          image_url?: string | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          title?: string
          unit_price_kobo?: number
          variant_id?: string | null
          variant_label?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount_kobo: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          method: string
          order_id: string
          reference: string | null
          status: string
        }
        Insert: {
          amount_kobo: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          method: string
          order_id: string
          reference?: string | null
          status?: string
        }
        Update: {
          amount_kobo?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          method?: string
          order_id?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string | null
          courier_id: string | null
          courier_name: string | null
          courier_service_code: string | null
          created_at: string
          decline_reason: string | null
          delivery_fee_kobo: number
          delivery_method: string
          guest_email: string | null
          guest_token: string
          id: string
          items_total_kobo: number
          platform_fee_kobo: number
          ship_to: Json | null
          shipbubble_order_id: string | null
          shipbubble_request_token: string | null
          status: string
          store_id: string
          total_kobo: number
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          courier_id?: string | null
          courier_name?: string | null
          courier_service_code?: string | null
          created_at?: string
          decline_reason?: string | null
          delivery_fee_kobo?: number
          delivery_method?: string
          guest_email?: string | null
          guest_token?: string
          id?: string
          items_total_kobo: number
          platform_fee_kobo?: number
          ship_to?: Json | null
          shipbubble_order_id?: string | null
          shipbubble_request_token?: string | null
          status?: string
          store_id: string
          total_kobo: number
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          courier_id?: string | null
          courier_name?: string | null
          courier_service_code?: string | null
          created_at?: string
          decline_reason?: string | null
          delivery_fee_kobo?: number
          delivery_method?: string
          guest_email?: string | null
          guest_token?: string
          id?: string
          items_total_kobo?: number
          platform_fee_kobo?: number
          ship_to?: Json | null
          shipbubble_order_id?: string | null
          shipbubble_request_token?: string | null
          status?: string
          store_id?: string
          total_kobo?: number
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_ledger: {
        Row: {
          amount_kobo: number
          created_at: string
          id: string
          kind: string
          note: string | null
          order_id: string
          paid_at: string | null
          status: string
          store_id: string | null
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          order_id: string
          paid_at?: string | null
          status?: string
          store_id?: string | null
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string
          paid_at?: string | null
          status?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_ledger_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          media_url: string
          position: number
          post_id: string
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          media_type: string
          media_url: string
          position: number
          post_id: string
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          position?: number
          post_id?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_product_tags: {
        Row: {
          created_at: string
          id: string
          post_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_product_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          audio_attribution: string | null
          audio_licence: string | null
          audio_name: string | null
          audio_source_url: string | null
          audio_url: string | null
          caption: string | null
          created_at: string
          created_with: string | null
          id: string
          location: string | null
          media_bytes: number | null
          media_type: string
          media_url: string
          status: string
          thumbnail_url: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          audio_attribution?: string | null
          audio_licence?: string | null
          audio_name?: string | null
          audio_source_url?: string | null
          audio_url?: string | null
          caption?: string | null
          created_at?: string
          created_with?: string | null
          id?: string
          location?: string | null
          media_bytes?: number | null
          media_type: string
          media_url: string
          status?: string
          thumbnail_url?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          audio_attribution?: string | null
          audio_licence?: string | null
          audio_name?: string | null
          audio_source_url?: string | null
          audio_url?: string | null
          caption?: string | null
          created_at?: string
          created_with?: string | null
          id?: string
          location?: string | null
          media_bytes?: number | null
          media_type?: string
          media_url?: string
          status?: string
          thumbnail_url?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          collection_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          created_at: string
          id: string
          option_id: string
          position: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          position: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          position?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_size_measurements: {
        Row: {
          created_at: string
          id: string
          measurement_key: string
          product_id: string
          size_value: string
          updated_at: string
          value_cm: number
        }
        Insert: {
          created_at?: string
          id?: string
          measurement_key: string
          product_id: string
          size_value: string
          updated_at?: string
          value_cm: number
        }
        Update: {
          created_at?: string
          id?: string
          measurement_key?: string
          product_id?: string
          size_value?: string
          updated_at?: string
          value_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_size_measurements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          created_at: string
          product_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_barcodes: {
        Row: {
          created_at: string
          id: string
          position: number
          type: string
          value: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          type?: string
          value: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          type?: string
          value?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_barcodes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_options: {
        Row: {
          option_id: string
          value_id: string
          variant_id: string
        }
        Insert: {
          option_id: string
          value_id: string
          variant_id: string
        }
        Update: {
          option_id?: string
          value_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_value_id_fkey"
            columns: ["value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_stock: {
        Row: {
          id: string
          location_id: string
          quantity: number
          variant_id: string
        }
        Insert: {
          id?: string
          location_id: string
          quantity?: number
          variant_id: string
        }
        Update: {
          id?: string
          location_id?: string
          quantity?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          additional_image_urls: string[] | null
          barcode: string | null
          colors: string[] | null
          compare_at_price: number | null
          continue_selling_out_of_stock: boolean
          cost_price: number | null
          created_at: string
          id: string
          main_image_url: string | null
          material: string | null
          material_feel: string | null
          option1_name: string | null
          option1_value: string | null
          option2_name: string | null
          option2_value: string | null
          option3_name: string | null
          option3_value: string | null
          price: number | null
          product_id: string
          sku: string | null
          stock_qty: number | null
          weight_grams: number | null
        }
        Insert: {
          additional_image_urls?: string[] | null
          barcode?: string | null
          colors?: string[] | null
          compare_at_price?: number | null
          continue_selling_out_of_stock?: boolean
          cost_price?: number | null
          created_at?: string
          id?: string
          main_image_url?: string | null
          material?: string | null
          material_feel?: string | null
          option1_name?: string | null
          option1_value?: string | null
          option2_name?: string | null
          option2_value?: string | null
          option3_name?: string | null
          option3_value?: string | null
          price?: number | null
          product_id: string
          sku?: string | null
          stock_qty?: number | null
          weight_grams?: number | null
        }
        Update: {
          additional_image_urls?: string[] | null
          barcode?: string | null
          colors?: string[] | null
          compare_at_price?: number | null
          continue_selling_out_of_stock?: boolean
          cost_price?: number | null
          created_at?: string
          id?: string
          main_image_url?: string | null
          material?: string | null
          material_feel?: string | null
          option1_name?: string | null
          option1_value?: string | null
          option2_name?: string | null
          option2_value?: string | null
          option3_name?: string | null
          option3_value?: string | null
          price?: number | null
          product_id?: string
          sku?: string | null
          stock_qty?: number | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          created_at: string
          description_long: string | null
          description_short: string | null
          external_handle: string | null
          handle: string
          id: string
          is_complete: boolean
          manual_size_system: string | null
          manual_size_value: string | null
          pass_fees_to_buyer: boolean
          product_type: string | null
          source_platform: string | null
          status: string
          store_id: string
          title: string | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description_long?: string | null
          description_short?: string | null
          external_handle?: string | null
          handle: string
          id?: string
          is_complete?: boolean
          manual_size_system?: string | null
          manual_size_value?: string | null
          pass_fees_to_buyer?: boolean
          product_type?: string | null
          source_platform?: string | null
          status?: string
          store_id: string
          title?: string | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description_long?: string | null
          description_short?: string | null
          external_handle?: string | null
          handle?: string
          id?: string
          is_complete?: boolean
          manual_size_system?: string | null
          manual_size_value?: string | null
          pass_fees_to_buyer?: boolean
          product_type?: string | null
          source_platform?: string | null
          status?: string
          store_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          date_of_birth: string | null
          display_name: string | null
          gender: string | null
          hide_store_stats: boolean
          id: string
          pending_offers_custom_orders: boolean
          pending_store_type: string | null
          personal_email: string
          personal_phone: string | null
          personal_username: string
          referral_source: string | null
          self_description: string | null
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          gender?: string | null
          hide_store_stats?: boolean
          id: string
          pending_offers_custom_orders?: boolean
          pending_store_type?: string | null
          personal_email: string
          personal_phone?: string | null
          personal_username: string
          referral_source?: string | null
          self_description?: string | null
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          gender?: string | null
          hide_store_stats?: boolean
          id?: string
          pending_offers_custom_orders?: boolean
          pending_store_type?: string | null
          personal_email?: string
          personal_phone?: string | null
          personal_username?: string
          referral_source?: string | null
          self_description?: string | null
        }
        Relationships: []
      }
      store_credentials: {
        Row: {
          bumpa_api_key: string | null
          bumpa_connected_at: string | null
          instagram_access_token: string | null
          instagram_connected_at: string | null
          instagram_token_expires_at: string | null
          instagram_user_id: string | null
          shopify_access_token: string | null
          shopify_connected_at: string | null
          shopify_scopes: string | null
          shopify_shop_domain: string | null
          store_id: string
        }
        Insert: {
          bumpa_api_key?: string | null
          bumpa_connected_at?: string | null
          instagram_access_token?: string | null
          instagram_connected_at?: string | null
          instagram_token_expires_at?: string | null
          instagram_user_id?: string | null
          shopify_access_token?: string | null
          shopify_connected_at?: string | null
          shopify_scopes?: string | null
          shopify_shop_domain?: string | null
          store_id: string
        }
        Update: {
          bumpa_api_key?: string | null
          bumpa_connected_at?: string | null
          instagram_access_token?: string | null
          instagram_connected_at?: string | null
          instagram_token_expires_at?: string | null
          instagram_user_id?: string | null
          shopify_access_token?: string | null
          shopify_connected_at?: string | null
          shopify_scopes?: string | null
          shopify_shop_domain?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_credentials_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_locations: {
        Row: {
          address_line: string | null
          address_line2: string | null
          address_verified_at: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          postal_code: string | null
          state: string | null
          store_id: string
          verified_address: string | null
        }
        Insert: {
          address_line?: string | null
          address_line2?: string | null
          address_verified_at?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          postal_code?: string | null
          state?: string | null
          store_id: string
          verified_address?: string | null
        }
        Update: {
          address_line?: string | null
          address_line2?: string | null
          address_verified_at?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          postal_code?: string | null
          state?: string | null
          store_id?: string
          verified_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_locations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payout_accounts: {
        Row: {
          account_name: string | null
          account_number: string
          bank_name: string
          created_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          bank_name: string
          created_at?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          bank_name?: string
          created_at?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payout_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pieces: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          media_url: string
          status: string
          store_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          media_url: string
          status?: string
          store_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          media_url?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_pieces_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_shipping_settings: {
        Row: {
          default_weight_kg: number
          flat_rate_kobo: number | null
          local_pickup: boolean
          location_rates: Json
          pickup_location_id: string | null
          shipbubble_sender_address_code: number | null
          store_id: string
          strategy: string
          updated_at: string
        }
        Insert: {
          default_weight_kg?: number
          flat_rate_kobo?: number | null
          local_pickup?: boolean
          location_rates?: Json
          pickup_location_id?: string | null
          shipbubble_sender_address_code?: number | null
          store_id: string
          strategy?: string
          updated_at?: string
        }
        Update: {
          default_weight_kg?: number
          flat_rate_kobo?: number | null
          local_pickup?: boolean
          location_rates?: Json
          pickup_location_id?: string | null
          shipbubble_sender_address_code?: number | null
          store_id?: string
          strategy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_shipping_settings_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_shipping_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_theme_customizations: {
        Row: {
          collections_mode: string
          created_at: string
          hidden_blocks: string[]
          id: string
          layout_id: string
          logo_image_url: string | null
          logo_mode: string
          slideshow_image_urls: string[]
          sticky_bottom: boolean | null
          store_id: string
          text: Json
          text_fonts: Json
          theme_slug: string
          updated_at: string
        }
        Insert: {
          collections_mode?: string
          created_at?: string
          hidden_blocks?: string[]
          id?: string
          layout_id?: string
          logo_image_url?: string | null
          logo_mode?: string
          slideshow_image_urls?: string[]
          sticky_bottom?: boolean | null
          store_id: string
          text?: Json
          text_fonts?: Json
          theme_slug: string
          updated_at?: string
        }
        Update: {
          collections_mode?: string
          created_at?: string
          hidden_blocks?: string[]
          id?: string
          layout_id?: string
          logo_image_url?: string | null
          logo_mode?: string
          slideshow_image_urls?: string[]
          sticky_bottom?: boolean | null
          store_id?: string
          text?: Json
          text_fonts?: Json
          theme_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_theme_customizations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_theme_customizations_theme_slug_fkey"
            columns: ["theme_slug"]
            isOneToOne: false
            referencedRelation: "store_themes"
            referencedColumns: ["slug"]
          },
        ]
      }
      store_themes: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          preview_url: string
          slug: string
          sort_order: number
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          preview_url: string
          slug: string
          sort_order?: number
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          preview_url?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      stores: {
        Row: {
          bio: string | null
          brand_name: string
          bumpa_store_id: string | null
          business_email: string | null
          business_phone: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          offers_custom_orders: boolean | null
          onboarded_at: string | null
          owner_id: string
          personal_storefront_only: boolean
          pickup_address_line: string | null
          pickup_address_line2: string | null
          pickup_city: string | null
          pickup_country: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location_updated_at: string | null
          pickup_postal_code: string | null
          pickup_state: string | null
          product_category: string[] | null
          shopify_access_token: string | null
          shopify_connected_at: string | null
          shopify_scopes: string | null
          shopify_shop_domain: string | null
          store_profile_only: boolean
          store_type: string | null
          store_username: string
          theme_id: string | null
        }
        Insert: {
          bio?: string | null
          brand_name: string
          bumpa_store_id?: string | null
          business_email?: string | null
          business_phone?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          offers_custom_orders?: boolean | null
          onboarded_at?: string | null
          owner_id: string
          personal_storefront_only?: boolean
          pickup_address_line?: string | null
          pickup_address_line2?: string | null
          pickup_city?: string | null
          pickup_country?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location_updated_at?: string | null
          pickup_postal_code?: string | null
          pickup_state?: string | null
          product_category?: string[] | null
          shopify_access_token?: string | null
          shopify_connected_at?: string | null
          shopify_scopes?: string | null
          shopify_shop_domain?: string | null
          store_profile_only?: boolean
          store_type?: string | null
          store_username: string
          theme_id?: string | null
        }
        Update: {
          bio?: string | null
          brand_name?: string
          bumpa_store_id?: string | null
          business_email?: string | null
          business_phone?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          offers_custom_orders?: boolean | null
          onboarded_at?: string | null
          owner_id?: string
          personal_storefront_only?: boolean
          pickup_address_line?: string | null
          pickup_address_line2?: string | null
          pickup_city?: string | null
          pickup_country?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location_updated_at?: string | null
          pickup_postal_code?: string | null
          pickup_state?: string | null
          product_category?: string[] | null
          shopify_access_token?: string | null
          shopify_connected_at?: string | null
          shopify_scopes?: string | null
          shopify_shop_domain?: string | null
          store_profile_only?: boolean
          store_type?: string | null
          store_username?: string
          theme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "store_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          media_meta: Json | null
          media_path: string | null
          sender: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          media_meta?: Json | null
          media_path?: string | null
          sender?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          media_meta?: Json | null
          media_path?: string | null
          sender?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          store_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      custom_category_requests: {
        Row: {
          first_seen: string | null
          last_seen: string | null
          parent: string | null
          products: number | null
          requested_name: string | null
          stores: number | null
        }
        Relationships: []
      }
      profile_stats: {
        Row: {
          followers_count: number | null
          following_count: number | null
          id: string | null
          rating: number | null
          rating_count: number | null
          sold_items_count: number | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          hide_store_stats: boolean | null
          id: string | null
          personal_username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          hide_store_stats?: boolean | null
          id?: string | null
          personal_username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          hide_store_stats?: boolean | null
          id?: string | null
          personal_username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      chat_media_conversation: {
        Args: { object_name: string }
        Returns: string
      }
      is_conversation_blocked: { Args: { conv: string }; Returns: boolean }
      is_conversation_member: { Args: { conv: string }; Returns: boolean }
      is_email_registered: { Args: { check_email: string }; Returns: boolean }
      is_username_available: {
        Args: { check_username: string }
        Returns: boolean
      }
      list_inbox: {
        Args: never
        Returns: {
          archived_at: string
          blocked_by_me: boolean
          cleared_at: string
          conversation_id: string
          kind: string
          last_message_at: string
          last_message_body: string
          last_message_created_at: string
          last_message_deleted: boolean
          last_message_id: string
          last_message_kind: string
          last_message_meta: Json
          last_message_sender_id: string
          last_read_at: string
          marked_unread: boolean
          muted: boolean
          other_avatar_url: string
          other_display_name: string
          other_last_active_at: string
          other_last_delivered_at: string
          other_last_read_at: string
          other_user_id: string
          other_username: string
          pinned_at: string
          unread_count: number
        }[]
      }
      my_read_receipts_enabled: { Args: never; Returns: boolean }
      owns_collection: { Args: { cid: string }; Returns: boolean }
      owns_location: { Args: { lid: string }; Returns: boolean }
      owns_option: { Args: { oid: string }; Returns: boolean }
      owns_product: { Args: { pid: string }; Returns: boolean }
      owns_store: { Args: { sid: string }; Returns: boolean }
      owns_tag: { Args: { tid: string }; Returns: boolean }
      owns_variant: { Args: { vid: string }; Returns: boolean }
      read_receipts_enabled: { Args: { uid: string }; Returns: boolean }
      start_direct_conversation: {
        Args: { other_user: string }
        Returns: string
      }
      start_self_conversation: { Args: never; Returns: string }
      touch_messaging_presence: { Args: never; Returns: undefined }
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
