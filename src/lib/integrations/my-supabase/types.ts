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
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          store_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          store_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
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
      product_variants: {
        Row: {
          additional_image_urls: string[] | null
          barcode: string | null
          compare_at_price: number | null
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
          compare_at_price?: number | null
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
          compare_at_price?: number | null
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
          display_name: string | null
          gender: string | null
          id: string
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
          display_name?: string | null
          gender?: string | null
          id: string
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
          display_name?: string | null
          gender?: string | null
          id?: string
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
      store_payout_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          created_at?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string
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
      store_themes: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          preview_url: string
          sort_order: number
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          preview_url: string
          sort_order?: number
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          preview_url?: string
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
          offers_custom_orders: boolean | null
          owner_id: string
          product_category: string[] | null
          shopify_access_token: string | null
          shopify_connected_at: string | null
          shopify_scopes: string | null
          shopify_shop_domain: string | null
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
          offers_custom_orders?: boolean | null
          owner_id: string
          product_category?: string[] | null
          shopify_access_token?: string | null
          shopify_connected_at?: string | null
          shopify_scopes?: string | null
          shopify_shop_domain?: string | null
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
          offers_custom_orders?: boolean | null
          owner_id?: string
          product_category?: string[] | null
          shopify_access_token?: string | null
          shopify_connected_at?: string | null
          shopify_scopes?: string | null
          shopify_shop_domain?: string | null
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
            foreignKeyName: "stores_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "store_themes"
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
    }
    Views: {
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
