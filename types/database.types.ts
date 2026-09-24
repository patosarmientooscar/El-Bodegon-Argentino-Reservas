// Tipos generados a mano a partir de supabase/migrations/*.sql.
//
// En cuanto el proyecto esté enlazado a una instancia real de Supabase,
// reemplaza este archivo con la salida de:
//   npm run db:types
// (equivalente a `supabase gen types typescript --linked`).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TableShape = "round" | "square" | "rectangular";
export type TableStatusOverride = "blocked";
export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "no_show" | "seated";
export type ReservationSource = "web" | "phone" | "walk_in" | "whatsapp";
export type Turno = "lunch" | "dinner";
export type SpecialDateType = "closed" | "blocked";
export type UserRole = "admin" | "staff";
export type DefaultView = "list" | "grid";

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          name: string;
          logo_url: string | null;
          address: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url?: string | null;
          address?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["restaurants"]["Insert"]>;
        Relationships: [];
      };
      restaurant_settings: {
        Row: {
          id: string;
          restaurant_id: string;
          reservation_buffer_minutes: number;
          min_lead_time_minutes: number;
          max_advance_days: number;
          max_party_size: number;
          default_reservation_duration_minutes: number;
          default_view: DefaultView;
          deposit_policy: Json | null;
          notification_settings: Json | null;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          reservation_buffer_minutes?: number;
          min_lead_time_minutes?: number;
          max_advance_days?: number;
          max_party_size?: number;
          default_reservation_duration_minutes?: number;
          default_view?: DefaultView;
          deposit_policy?: Json | null;
          notification_settings?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["restaurant_settings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: true;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      tables: {
        Row: {
          id: string;
          restaurant_id: string;
          number: number;
          capacity: number;
          shape: TableShape;
          pos_x: number;
          pos_y: number;
          status_override: TableStatusOverride | null;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          number: number;
          capacity: number;
          shape?: TableShape;
          pos_x?: number;
          pos_y?: number;
          status_override?: TableStatusOverride | null;
        };
        Update: Partial<Database["public"]["Tables"]["tables"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      reservations: {
        Row: {
          id: string;
          restaurant_id: string;
          table_id: string | null;
          customer_name: string;
          customer_phone: string | null;
          party_size: number;
          start_time: string;
          duration_minutes: number;
          status: ReservationStatus;
          source: ReservationSource;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          table_id?: string | null;
          customer_name: string;
          customer_phone?: string | null;
          party_size: number;
          start_time: string;
          duration_minutes: number;
          status?: ReservationStatus;
          source?: ReservationSource;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reservations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "reservations_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "tables";
            referencedColumns: ["id"];
          },
        ];
      };
      service_hours: {
        Row: {
          id: string;
          restaurant_id: string;
          day_of_week: number;
          turno: Turno;
          open_time: string | null;
          close_time: string | null;
          closed: boolean;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          day_of_week: number;
          turno: Turno;
          open_time?: string | null;
          close_time?: string | null;
          closed?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["service_hours"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "service_hours_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      special_dates: {
        Row: {
          id: string;
          restaurant_id: string;
          date: string;
          type: SpecialDateType;
          note: string | null;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          date: string;
          type: SpecialDateType;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["special_dates"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "special_dates_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          id: string;
          restaurant_id: string | null;
          role: UserRole;
          name: string | null;
          email: string | null;
        };
        Insert: {
          id: string;
          restaurant_id?: string | null;
          role?: UserRole;
          name?: string | null;
          email?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "users_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_restaurant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
