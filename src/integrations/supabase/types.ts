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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      appointment_requests: {
        Row: {
          clinic_user_id: string
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string
          requested_datetime: string
          status: string
          updated_at: string
        }
        Insert: {
          clinic_user_id: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone: string
          requested_datetime: string
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_user_id?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string
          requested_datetime?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          availability_slot_id: string | null
          business_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          end_at: string
          id: string
          is_new_contact: boolean
          location: string | null
          modality: string | null
          notes: string | null
          patient_id: string | null
          payment_status: string | null
          service_id: string | null
          source: string
          start_at: string
          status: string
          updated_at: string
        }
        Insert: {
          availability_slot_id?: string | null
          business_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          end_at: string
          id?: string
          is_new_contact?: boolean
          location?: string | null
          modality?: string | null
          notes?: string | null
          patient_id?: string | null
          payment_status?: string | null
          service_id?: string | null
          source?: string
          start_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          availability_slot_id?: string | null
          business_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          end_at?: string
          id?: string
          is_new_contact?: boolean
          location?: string | null
          modality?: string | null
          notes?: string | null
          patient_id?: string | null
          payment_status?: string | null
          service_id?: string | null
          source?: string
          start_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_availability_slot_id_fkey"
            columns: ["availability_slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          business_id: string
          created_at: string
          date: string
          end_time: string
          id: string
          modality: string
          notes: string | null
          price: number | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          date: string
          end_time: string
          id?: string
          modality: string
          notes?: string | null
          price?: number | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          modality?: string
          notes?: string | null
          price?: number | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          contact_email: string
          created_at: string
          id: string
          name: string
          owner_user_id: string
          public_slug: string
          specialty: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          contact_email: string
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          public_slug: string
          specialty?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          public_slug?: string
          specialty?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinic_settings: {
        Row: {
          auto_accept_bookings: boolean
          clinic_name: string | null
          cover_image_url: string | null
          created_at: string
          default_confirmation_message: string | null
          default_postsession_message: string | null
          default_reminder_message: string | null
          id: string
          logo_url: string | null
          specialty: string | null
          updated_at: string
          user_id: string
          welcome_message: string | null
        }
        Insert: {
          auto_accept_bookings?: boolean
          clinic_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          default_confirmation_message?: string | null
          default_postsession_message?: string | null
          default_reminder_message?: string | null
          id?: string
          logo_url?: string | null
          specialty?: string | null
          updated_at?: string
          user_id: string
          welcome_message?: string | null
        }
        Update: {
          auto_accept_bookings?: boolean
          clinic_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          default_confirmation_message?: string | null
          default_postsession_message?: string | null
          default_reminder_message?: string | null
          id?: string
          logo_url?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          private_notes: string | null
          reason_for_consultation: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          private_notes?: string | null
          reason_for_consultation?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          private_notes?: string | null
          reason_for_consultation?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          anchor_day: number | null
          appointment_id: string | null
          business_id: string
          created_at: string
          currency: string
          due_date: string
          id: string
          method: string | null
          notes: string | null
          paid_at: string | null
          patient_id: string
          recurrence_type: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          anchor_day?: number | null
          appointment_id?: string | null
          business_id: string
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          patient_id: string
          recurrence_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          anchor_day?: number | null
          appointment_id?: string | null
          business_id?: string
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          patient_id?: string
          recurrence_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          message: string
          patient_id: string
          scheduled_for: string
          sent: boolean
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          message: string
          patient_id: string
          scheduled_for: string
          sent?: boolean
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          message?: string
          patient_id?: string
          scheduled_for?: string
          sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_appointment"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_patient"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          mode: string
          name: string
          suggested_price: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          mode: string
          name: string
          suggested_price?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          mode?: string
          name?: string
          suggested_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
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
