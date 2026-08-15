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
      admin_news: {
        Row: {
          ai_processed: boolean
          body: string
          category: string
          content_hash: string | null
          created_at: string
          created_by: string | null
          id: string
          link: string | null
          pub_date: string
          published: boolean
          source: string | null
          sources_meta: Json
          status: string
          summary: string | null
          team_ids: string[]
          thumb: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_processed?: boolean
          body: string
          category?: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          link?: string | null
          pub_date?: string
          published?: boolean
          source?: string | null
          sources_meta?: Json
          status?: string
          summary?: string | null
          team_ids?: string[]
          thumb?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_processed?: boolean
          body?: string
          category?: string
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          link?: string | null
          pub_date?: string
          published?: boolean
          source?: string | null
          sources_meta?: Json
          status?: string
          summary?: string | null
          team_ids?: string[]
          thumb?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          active: boolean
          created_at: string
          duration_sec: number
          ends_at: string | null
          id: string
          image_url: string
          link_url: string | null
          slot: string
          starts_at: string | null
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          duration_sec?: number
          ends_at?: string | null
          id?: string
          image_url: string
          link_url?: string | null
          slot: string
          starts_at?: string | null
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          duration_sec?: number
          ends_at?: string | null
          id?: string
          image_url?: string
          link_url?: string | null
          slot?: string
          starts_at?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      allowed_emails: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      bets: {
        Row: {
          actual_profit: number | null
          commence_time: string | null
          created_at: string
          expected_profit: number
          guaranteed_return: number
          id: string
          league: string | null
          market: string
          match_id: string | null
          match_name: string
          notes: string | null
          profit_margin: number
          selections: Json
          status: string
          total_stake: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_profit?: number | null
          commence_time?: string | null
          created_at?: string
          expected_profit: number
          guaranteed_return: number
          id?: string
          league?: string | null
          market: string
          match_id?: string | null
          match_name: string
          notes?: string | null
          profit_margin: number
          selections: Json
          status?: string
          total_stake: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_profit?: number | null
          commence_time?: string | null
          created_at?: string
          expected_profit?: number
          guaranteed_return?: number
          id?: string
          league?: string | null
          market?: string
          match_id?: string | null
          match_name?: string
          notes?: string | null
          profit_margin?: number
          selections?: Json
          status?: string
          total_stake?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      match_chat: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          match_id: string
          message: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          match_id: string
          message: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          match_id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      match_context_cache: {
        Row: {
          away: string
          cache_key: string
          home: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          away: string
          cache_key: string
          home: string
          payload: Json
          status?: string
          updated_at?: string
        }
        Update: {
          away?: string
          cache_key?: string
          home?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      match_dossier_cache: {
        Row: {
          commence_time: string
          dossier_data: Json
          dossier_text: string
          fetched_at: string
          match_id: string
          updated_at: string
        }
        Insert: {
          commence_time: string
          dossier_data: Json
          dossier_text: string
          fetched_at?: string
          match_id: string
          updated_at?: string
        }
        Update: {
          commence_time?: string
          dossier_data?: Json
          dossier_text?: string
          fetched_at?: string
          match_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      match_predictions: {
        Row: {
          avatar_url: string | null
          away_score: number
          created_at: string
          display_name: string
          home_score: number
          id: string
          match_id: string
          result: string
          updated_at: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          avatar_url?: string | null
          away_score: number
          created_at?: string
          display_name: string
          home_score: number
          id?: string
          match_id: string
          result?: string
          updated_at?: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          avatar_url?: string | null
          away_score?: number
          created_at?: string
          display_name?: string
          home_score?: number
          id?: string
          match_id?: string
          result?: string
          updated_at?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: []
      }
      match_votes: {
        Row: {
          created_at: string
          match_id: string
          updated_at: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          match_id: string
          updated_at?: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          match_id?: string
          updated_at?: string
          user_id?: string
          vote?: string
        }
        Relationships: []
      }
      matches_cache: {
        Row: {
          away: string
          away_goals: number | null
          away_logo: string | null
          best_away: number
          best_draw: number
          best_home: number
          bet365_away: number
          bet365_draw: number
          bet365_home: number
          bookmaker_count: number
          commence_time: string
          favorite_prob: number
          home: string
          home_goals: number | null
          home_logo: string | null
          id: string
          is_arb: boolean
          league: string
          league_logo: string | null
          market_margin: number
          match_type: string
          sport_key: string
          status_elapsed: number | null
          status_short: string | null
          updated_at: string
        }
        Insert: {
          away: string
          away_goals?: number | null
          away_logo?: string | null
          best_away?: number
          best_draw?: number
          best_home?: number
          bet365_away?: number
          bet365_draw?: number
          bet365_home?: number
          bookmaker_count?: number
          commence_time: string
          favorite_prob?: number
          home: string
          home_goals?: number | null
          home_logo?: string | null
          id: string
          is_arb?: boolean
          league: string
          league_logo?: string | null
          market_margin?: number
          match_type?: string
          sport_key: string
          status_elapsed?: number | null
          status_short?: string | null
          updated_at?: string
        }
        Update: {
          away?: string
          away_goals?: number | null
          away_logo?: string | null
          best_away?: number
          best_draw?: number
          best_home?: number
          bet365_away?: number
          bet365_draw?: number
          bet365_home?: number
          bookmaker_count?: number
          commence_time?: string
          favorite_prob?: number
          home?: string
          home_goals?: number | null
          home_logo?: string | null
          id?: string
          is_arb?: boolean
          league?: string
          league_logo?: string | null
          market_margin?: number
          match_type?: string
          sport_key?: string
          status_elapsed?: number | null
          status_short?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      news_cache: {
        Row: {
          fetched_at: string
          items: Json
          query: string
        }
        Insert: {
          fetched_at?: string
          items?: Json
          query: string
        }
        Update: {
          fetched_at?: string
          items?: Json
          query?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          cards: boolean
          goals: boolean
          match_end: boolean
          match_start: boolean
          quiet_end: string | null
          quiet_start: string | null
          team_news: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          cards?: boolean
          goals?: boolean
          match_end?: boolean
          match_start?: boolean
          quiet_end?: string | null
          quiet_start?: string | null
          team_news?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          cards?: boolean
          goals?: boolean
          match_end?: boolean
          match_start?: boolean
          quiet_end?: string | null
          quiet_start?: string | null
          team_news?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          initial_bankroll: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          initial_bankroll?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          initial_bankroll?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      standings_cache: {
        Row: {
          league_id: number
          rows: Json
          season: number
          updated_at: string
        }
        Insert: {
          league_id: number
          rows: Json
          season: number
          updated_at?: string
        }
        Update: {
          league_id?: number
          rows?: Json
          season?: number
          updated_at?: string
        }
        Relationships: []
      }
      team_fixtures_cache: {
        Row: {
          competition: string | null
          competition_logo: string | null
          fixture_date: string
          fixture_id: number
          goals_against: number | null
          goals_for: number | null
          kind: string
          opponent_id: number | null
          opponent_logo: string | null
          opponent_name: string | null
          result: string | null
          status: string | null
          team_id: number
          updated_at: string
          venue: string | null
        }
        Insert: {
          competition?: string | null
          competition_logo?: string | null
          fixture_date: string
          fixture_id: number
          goals_against?: number | null
          goals_for?: number | null
          kind: string
          opponent_id?: number | null
          opponent_logo?: string | null
          opponent_name?: string | null
          result?: string | null
          status?: string | null
          team_id: number
          updated_at?: string
          venue?: string | null
        }
        Update: {
          competition?: string | null
          competition_logo?: string | null
          fixture_date?: string
          fixture_id?: number
          goals_against?: number | null
          goals_for?: number | null
          kind?: string
          opponent_id?: number | null
          opponent_logo?: string | null
          opponent_name?: string | null
          result?: string | null
          status?: string | null
          team_id?: number
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      teams_cache: {
        Row: {
          code: string | null
          country: string | null
          founded: number | null
          id: number
          injuries: Json | null
          league_country: string | null
          league_flag: string | null
          league_id: number | null
          league_logo: string | null
          league_name: string | null
          league_season: number | null
          logo: string | null
          name: string
          name_normalized: string
          national: boolean | null
          rank: number | null
          squad: Json | null
          stats: Json | null
          top_scorers: Json | null
          transfers: Json | null
          trophies: Json | null
          updated_at: string
          venue_capacity: number | null
          venue_city: string | null
          venue_image: string | null
          venue_name: string | null
        }
        Insert: {
          code?: string | null
          country?: string | null
          founded?: number | null
          id: number
          injuries?: Json | null
          league_country?: string | null
          league_flag?: string | null
          league_id?: number | null
          league_logo?: string | null
          league_name?: string | null
          league_season?: number | null
          logo?: string | null
          name: string
          name_normalized: string
          national?: boolean | null
          rank?: number | null
          squad?: Json | null
          stats?: Json | null
          top_scorers?: Json | null
          transfers?: Json | null
          trophies?: Json | null
          updated_at?: string
          venue_capacity?: number | null
          venue_city?: string | null
          venue_image?: string | null
          venue_name?: string | null
        }
        Update: {
          code?: string | null
          country?: string | null
          founded?: number | null
          id?: number
          injuries?: Json | null
          league_country?: string | null
          league_flag?: string | null
          league_id?: number | null
          league_logo?: string | null
          league_name?: string | null
          league_season?: number | null
          logo?: string | null
          name?: string
          name_normalized?: string
          national?: boolean | null
          rank?: number | null
          squad?: Json | null
          stats?: Json | null
          top_scorers?: Json | null
          transfers?: Json | null
          trophies?: Json | null
          updated_at?: string
          venue_capacity?: number | null
          venue_city?: string | null
          venue_image?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          badges: string[]
          created_at: string
          display_name: string | null
          favorite_team: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          badges?: string[]
          created_at?: string
          display_name?: string | null
          favorite_team?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          badges?: string[]
          created_at?: string
          display_name?: string | null
          favorite_team?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          xp?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      match_vote_counts: {
        Row: {
          away_votes: number | null
          draw_votes: number | null
          home_votes: number | null
          match_id: string | null
          total_votes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_email_allowed: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
