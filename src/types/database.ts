export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
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
  public: {
    Tables: {
      author_contact_lookups: {
        Row: {
          author_id: string
          created_at: string
          id: string
          klash_id: string
          looked_up_by: string
          looked_up_role: Database['public']['Enums']['user_role']
        }
        ComputedFields: never
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          klash_id: string
          looked_up_by: string
          looked_up_role: Database['public']['Enums']['user_role']
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          klash_id?: string
          looked_up_by?: string
          looked_up_role?: Database['public']['Enums']['user_role']
        }
        Relationships: [
          {
            foreignKeyName: 'author_contact_lookups_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'author_contact_lookups_klash_id_fkey'
            columns: ['klash_id']
            isOneToOne: false
            referencedRelation: 'klashes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'author_contact_lookups_klash_id_fkey'
            columns: ['klash_id']
            isOneToOne: false
            referencedRelation: 'klashes_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'author_contact_lookups_looked_up_by_fkey'
            columns: ['looked_up_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      campaign_link_scans: {
        Row: {
          id: number
          link_was_active: boolean
          scanned_at: string
          slug: string
        }
        ComputedFields: never
        Insert: {
          id?: never
          link_was_active: boolean
          scanned_at?: string
          slug: string
        }
        Update: {
          id?: never
          link_was_active?: boolean
          scanned_at?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: 'campaign_link_scans_slug_fkey'
            columns: ['slug']
            isOneToOne: false
            referencedRelation: 'campaign_links'
            referencedColumns: ['slug']
          },
        ]
      }
      campaign_links: {
        Row: {
          campaign: string
          content: string
          created_at: string
          created_by: string | null
          destination: string
          is_active: boolean
          medium: Database['public']['Enums']['campaign_medium']
          slug: string
          source: string
        }
        ComputedFields: never
        Insert: {
          campaign: string
          content?: string
          created_at?: string
          created_by?: string | null
          destination?: string
          is_active?: boolean
          medium: Database['public']['Enums']['campaign_medium']
          slug: string
          source: string
        }
        Update: {
          campaign?: string
          content?: string
          created_at?: string
          created_by?: string | null
          destination?: string
          is_active?: boolean
          medium?: Database['public']['Enums']['campaign_medium']
          slug?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: 'campaign_links_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'campaign_links_source_fkey'
            columns: ['source']
            isOneToOne: false
            referencedRelation: 'campaign_sources'
            referencedColumns: ['source']
          },
        ]
      }
      campaign_sources: {
        Row: {
          source: string
        }
        ComputedFields: never
        Insert: {
          source: string
        }
        Update: {
          source?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          hidden: boolean
          id: string
          klash_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          author_id: string
          body: string
          created_at?: string
          hidden?: boolean
          id?: string
          klash_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          hidden?: boolean
          id?: string
          klash_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comments_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_klash_id_fkey'
            columns: ['klash_id']
            isOneToOne: false
            referencedRelation: 'klashes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_klash_id_fkey'
            columns: ['klash_id']
            isOneToOne: false
            referencedRelation: 'klashes_public'
            referencedColumns: ['id']
          },
        ]
      }
      confirmations: {
        Row: {
          created_at: string
          klash_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          klash_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          klash_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'confirmations_klash_id_fkey'
            columns: ['klash_id']
            isOneToOne: false
            referencedRelation: 'klashes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'confirmations_klash_id_fkey'
            columns: ['klash_id']
            isOneToOne: false
            referencedRelation: 'klashes_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'confirmations_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      klash_photos: {
        Row: {
          author_id: string
          created_at: string
          height: number | null
          id: string
          klash_id: string
          storage_path: string
          width: number | null
        }
        ComputedFields: never
        Insert: {
          author_id: string
          created_at?: string
          height?: number | null
          id?: string
          klash_id: string
          storage_path: string
          width?: number | null
        }
        Update: {
          author_id?: string
          created_at?: string
          height?: number | null
          id?: string
          klash_id?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'klash_photos_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'klash_photos_klash_id_fkey'
            columns: ['klash_id']
            isOneToOne: false
            referencedRelation: 'klashes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'klash_photos_klash_id_fkey'
            columns: ['klash_id']
            isOneToOne: false
            referencedRelation: 'klashes_public'
            referencedColumns: ['id']
          },
        ]
      }
      klashes: {
        Row: {
          author_id: string
          category: Database['public']['Enums']['klash_category']
          category_other: string | null
          comments_count: number
          confirmations_count: number
          created_at: string
          description: string | null
          duplicate_of: string | null
          id: string
          importance: Database['public']['Enums']['klash_importance']
          location: unknown
          proposed_solution: string | null
          resolved_at: string | null
          status: Database['public']['Enums']['klash_status']
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          author_id: string
          category: Database['public']['Enums']['klash_category']
          category_other?: string | null
          comments_count?: number
          confirmations_count?: number
          created_at?: string
          description?: string | null
          duplicate_of?: string | null
          id?: string
          importance?: Database['public']['Enums']['klash_importance']
          location: unknown
          proposed_solution?: string | null
          resolved_at?: string | null
          status?: Database['public']['Enums']['klash_status']
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: Database['public']['Enums']['klash_category']
          category_other?: string | null
          comments_count?: number
          confirmations_count?: number
          created_at?: string
          description?: string | null
          duplicate_of?: string | null
          id?: string
          importance?: Database['public']['Enums']['klash_importance']
          location?: unknown
          proposed_solution?: string | null
          resolved_at?: string | null
          status?: Database['public']['Enums']['klash_status']
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'klashes_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'klashes_duplicate_of_fkey'
            columns: ['duplicate_of']
            isOneToOne: false
            referencedRelation: 'klashes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'klashes_duplicate_of_fkey'
            columns: ['duplicate_of']
            isOneToOne: false
            referencedRelation: 'klashes_public'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          can_manage_campaigns: boolean
          created_at: string
          display_name: string | null
          id: string
          organization: string | null
          role: Database['public']['Enums']['user_role']
        }
        ComputedFields: never
        Insert: {
          can_manage_campaigns?: boolean
          created_at?: string
          display_name?: string | null
          id: string
          organization?: string | null
          role?: Database['public']['Enums']['user_role']
        }
        Update: {
          can_manage_campaigns?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          organization?: string | null
          role?: Database['public']['Enums']['user_role']
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          key: string
          updated_at?: string
          value: NonNullable<Json>
        }
        Update: {
          key?: string
          updated_at?: string
          value?: NonNullable<Json>
        }
        Relationships: []
      }
      status_changes: {
        Row: {
          changed_by: string
          created_at: string
          from_status: Database['public']['Enums']['klash_status']
          id: string
          klash_id: string
          note: string | null
          to_status: Database['public']['Enums']['klash_status']
        }
        ComputedFields: never
        Insert: {
          changed_by: string
          created_at?: string
          from_status: Database['public']['Enums']['klash_status']
          id?: string
          klash_id: string
          note?: string | null
          to_status: Database['public']['Enums']['klash_status']
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_status?: Database['public']['Enums']['klash_status']
          id?: string
          klash_id?: string
          note?: string | null
          to_status?: Database['public']['Enums']['klash_status']
        }
        Relationships: [
          {
            foreignKeyName: 'status_changes_changed_by_fkey'
            columns: ['changed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'status_changes_klash_id_fkey'
            columns: ['klash_id']
            isOneToOne: false
            referencedRelation: 'klashes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'status_changes_klash_id_fkey'
            columns: ['klash_id']
            isOneToOne: false
            referencedRelation: 'klashes_public'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      klashes_public: {
        Row: {
          author_display_name: string | null
          author_id: string | null
          author_organization: string | null
          author_role: Database['public']['Enums']['user_role'] | null
          category: Database['public']['Enums']['klash_category'] | null
          category_other: string | null
          comments_count: number | null
          confirmations_count: number | null
          created_at: string | null
          description: string | null
          duplicate_of: string | null
          id: string | null
          importance: Database['public']['Enums']['klash_importance'] | null
          lat: number | null
          lng: number | null
          proposed_solution: string | null
          resolved_at: string | null
          status: Database['public']['Enums']['klash_status'] | null
          title: string | null
          updated_at: string | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: 'klashes_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'klashes_duplicate_of_fkey'
            columns: ['duplicate_of']
            isOneToOne: false
            referencedRelation: 'klashes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'klashes_duplicate_of_fkey'
            columns: ['duplicate_of']
            isOneToOne: false
            referencedRelation: 'klashes_public'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      can_change_klash_status: {
        Args: {
          from_status: Database['public']['Enums']['klash_status']
          role: Database['public']['Enums']['user_role']
          to_status: Database['public']['Enums']['klash_status']
        }
        Returns: boolean
      }
      change_klash_status: {
        Args: {
          klash_id: string
          note?: string
          to_status: Database['public']['Enums']['klash_status']
        }
        Returns: {
          author_display_name: string | null
          author_id: string | null
          author_organization: string | null
          author_role: Database['public']['Enums']['user_role'] | null
          category: Database['public']['Enums']['klash_category'] | null
          category_other: string | null
          comments_count: number | null
          confirmations_count: number | null
          created_at: string | null
          description: string | null
          duplicate_of: string | null
          id: string | null
          importance: Database['public']['Enums']['klash_importance'] | null
          lat: number | null
          lng: number | null
          proposed_solution: string | null
          resolved_at: string | null
          status: Database['public']['Enums']['klash_status'] | null
          title: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'klashes_public'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_campaign_link: {
        Args: {
          p_campaign: string
          p_content?: string
          p_destination?: string
          p_medium: Database['public']['Enums']['campaign_medium']
          p_source: string
        }
        Returns: {
          campaign: string
          content: string
          created_at: string
          created_by: string | null
          destination: string
          is_active: boolean
          medium: Database['public']['Enums']['campaign_medium']
          slug: string
          source: string
        }
        SetofOptions: {
          from: '*'
          to: 'campaign_links'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_klash: {
        Args: {
          category: Database['public']['Enums']['klash_category']
          category_other?: string
          description: string
          importance: Database['public']['Enums']['klash_importance']
          lat: number
          lng: number
          proposed_solution?: string
          title: string
        }
        Returns: {
          author_display_name: string | null
          author_id: string | null
          author_organization: string | null
          author_role: Database['public']['Enums']['user_role'] | null
          category: Database['public']['Enums']['klash_category'] | null
          category_other: string | null
          comments_count: number | null
          confirmations_count: number | null
          created_at: string | null
          description: string | null
          duplicate_of: string | null
          id: string | null
          importance: Database['public']['Enums']['klash_importance'] | null
          lat: number | null
          lng: number | null
          proposed_solution: string | null
          resolved_at: string | null
          status: Database['public']['Enums']['klash_status'] | null
          title: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'klashes_public'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_can_manage_campaigns: { Args: Record<PropertyKey, never>; Returns: boolean }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Enums']['user_role']
      }
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined }
      find_profile_by_email: {
        Args: { email: string }
        Returns: {
          display_name: string
          id: string
          organization: string
          role: Database['public']['Enums']['user_role']
        }[]
      }
      get_klash_author_contact: { Args: { klash_id: string }; Returns: string }
      is_campaign_token: { Args: { value: string }; Returns: boolean }
      klashes_in_bbox: {
        Args: { max_lat: number; max_lng: number; min_lat: number; min_lng: number }
        Returns: {
          author_display_name: string | null
          author_id: string | null
          author_organization: string | null
          author_role: Database['public']['Enums']['user_role'] | null
          category: Database['public']['Enums']['klash_category'] | null
          category_other: string | null
          comments_count: number | null
          confirmations_count: number | null
          created_at: string | null
          description: string | null
          duplicate_of: string | null
          id: string | null
          importance: Database['public']['Enums']['klash_importance'] | null
          lat: number | null
          lng: number | null
          proposed_solution: string | null
          resolved_at: string | null
          status: Database['public']['Enums']['klash_status'] | null
          title: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'klashes_public'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      klashes_nearby: {
        Args: { origin_lat: number; origin_lng: number; radius_m: number }
        Returns: {
          author_display_name: string | null
          author_id: string | null
          author_organization: string | null
          author_role: Database['public']['Enums']['user_role'] | null
          category: Database['public']['Enums']['klash_category'] | null
          category_other: string | null
          comments_count: number | null
          confirmations_count: number | null
          created_at: string | null
          description: string | null
          duplicate_of: string | null
          id: string | null
          importance: Database['public']['Enums']['klash_importance'] | null
          lat: number | null
          lng: number | null
          proposed_solution: string | null
          resolved_at: string | null
          status: Database['public']['Enums']['klash_status'] | null
          title: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'klashes_public'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      normalize_campaign_token: { Args: { value: string }; Returns: string }
      purge_author_contact_lookups: { Args: Record<PropertyKey, never>; Returns: undefined }
      resolve_campaign_link: {
        Args: { p_count?: boolean; p_slug: string }
        Returns: {
          campaign: string
          content: string
          destination: string
          medium: Database['public']['Enums']['campaign_medium']
          source: string
        }[]
      }
    }
    Enums: {
      campaign_medium: 'social' | 'email' | 'print' | 'press'
      klash_category:
        | 'category_1'
        | 'category_2'
        | 'category_3'
        | 'category_4'
        | 'category_5'
        | 'category_6'
        | 'category_7'
        | 'category_8'
      klash_importance: 'low' | 'medium' | 'high'
      klash_status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'rejected' | 'duplicate'
      user_role: 'user' | 'moderator' | 'authority' | 'admin'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      campaign_medium: ['social', 'email', 'print', 'press'],
      klash_category: [
        'category_1',
        'category_2',
        'category_3',
        'category_4',
        'category_5',
        'category_6',
        'category_7',
        'category_8',
      ],
      klash_importance: ['low', 'medium', 'high'],
      klash_status: ['new', 'acknowledged', 'in_progress', 'resolved', 'rejected', 'duplicate'],
      user_role: ['user', 'moderator', 'authority', 'admin'],
    },
  },
} as const
