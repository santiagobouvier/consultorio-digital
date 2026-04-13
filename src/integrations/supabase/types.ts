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
          professional_id: string | null
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
          professional_id?: string | null
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
          professional_id?: string | null
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
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public_branding"
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
          {
            foreignKeyName: "availability_slots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          billing_period: string
          contact_email: string
          created_at: string
          custom_domain: string | null
          custom_max_patients: number | null
          custom_max_professionals: number | null
          custom_subdomain: string | null
          dashboard_display_name: string | null
          dashboard_logo_url: string | null
          dashboard_primary_color: string | null
          id: string
          is_active: boolean
          is_demo: boolean
          is_private_clinic: boolean
          name: string
          onboarding_completed: boolean
          owner_user_id: string
          plan_code: string
          plan_expires_at: string | null
          plan_started_at: string | null
          portal_clinic_display_name: string | null
          portal_dark_primary_color: string | null
          portal_logo_url: string | null
          portal_primary_color: string | null
          portal_theme_preset: string | null
          public_slug: string
          shared_calendar: boolean
          specialty: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          billing_period?: string
          contact_email: string
          created_at?: string
          custom_domain?: string | null
          custom_max_patients?: number | null
          custom_max_professionals?: number | null
          custom_subdomain?: string | null
          dashboard_display_name?: string | null
          dashboard_logo_url?: string | null
          dashboard_primary_color?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          is_private_clinic?: boolean
          name: string
          onboarding_completed?: boolean
          owner_user_id: string
          plan_code?: string
          plan_expires_at?: string | null
          plan_started_at?: string | null
          portal_clinic_display_name?: string | null
          portal_dark_primary_color?: string | null
          portal_logo_url?: string | null
          portal_primary_color?: string | null
          portal_theme_preset?: string | null
          public_slug: string
          shared_calendar?: boolean
          specialty?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          billing_period?: string
          contact_email?: string
          created_at?: string
          custom_domain?: string | null
          custom_max_patients?: number | null
          custom_max_professionals?: number | null
          custom_subdomain?: string | null
          dashboard_display_name?: string | null
          dashboard_logo_url?: string | null
          dashboard_primary_color?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          is_private_clinic?: boolean
          name?: string
          onboarding_completed?: boolean
          owner_user_id?: string
          plan_code?: string
          plan_expires_at?: string | null
          plan_started_at?: string | null
          portal_clinic_display_name?: string | null
          portal_dark_primary_color?: string | null
          portal_logo_url?: string | null
          portal_primary_color?: string | null
          portal_theme_preset?: string | null
          public_slug?: string
          shared_calendar?: boolean
          specialty?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinic_settings: {
        Row: {
          auto_accept_bookings: boolean
          auto_email_reminders: boolean
          auto_whatsapp_reminders: boolean
          clinic_name: string | null
          cover_image_url: string | null
          created_at: string
          default_confirmation_message: string | null
          default_postsession_message: string | null
          default_reminder_message: string | null
          id: string
          logo_url: string | null
          reminder_hours_before: number
          specialty: string | null
          updated_at: string
          user_id: string
          welcome_message: string | null
        }
        Insert: {
          auto_accept_bookings?: boolean
          auto_email_reminders?: boolean
          auto_whatsapp_reminders?: boolean
          clinic_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          default_confirmation_message?: string | null
          default_postsession_message?: string | null
          default_reminder_message?: string | null
          id?: string
          logo_url?: string | null
          reminder_hours_before?: number
          specialty?: string | null
          updated_at?: string
          user_id: string
          welcome_message?: string | null
        }
        Update: {
          auto_accept_bookings?: boolean
          auto_email_reminders?: boolean
          auto_whatsapp_reminders?: boolean
          clinic_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          default_confirmation_message?: string | null
          default_postsession_message?: string | null
          default_reminder_message?: string | null
          id?: string
          logo_url?: string | null
          reminder_hours_before?: number
          specialty?: string | null
          updated_at?: string
          user_id?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      patient_portal_invites: {
        Row: {
          auth_user_id: string
          created_at: string
          expires_at: string
          id: string
          patient_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          expires_at?: string
          id?: string
          patient_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          patient_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_portal_invites_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
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
          auth_user_id?: string | null
          avatar_url?: string | null
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
          auth_user_id?: string | null
          avatar_url?: string | null
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
          {
            foreignKeyName: "patients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public_branding"
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
      professional_portal_invites: {
        Row: {
          auth_user_id: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string | null
          id: string
          name: string
          token: string
          used_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          business_id: string
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          name: string
          token: string
          used_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          name?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_portal_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_portal_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public_branding"
            referencedColumns: ["id"]
          },
        ]
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
      push_subscriptions: {
        Row: {
          auth: string
          business_id: string | null
          created_at: string
          device_type: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          business_id?: string | null
          created_at?: string
          device_type?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          business_id?: string | null
          created_at?: string
          device_type?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reminders: {
        Row: {
          appointment_id: string
          auto_send: boolean
          business_id: string
          channel: string
          created_at: string
          id: string
          message: string
          patient_id: string
          scheduled_for: string
          status: string
          type: string
        }
        Insert: {
          appointment_id: string
          auto_send?: boolean
          business_id: string
          channel?: string
          created_at?: string
          id?: string
          message: string
          patient_id: string
          scheduled_for: string
          status?: string
          type?: string
        }
        Update: {
          appointment_id?: string
          auto_send?: boolean
          business_id?: string
          channel?: string
          created_at?: string
          id?: string
          message?: string
          patient_id?: string
          scheduled_for?: string
          status?: string
          type?: string
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
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          billing_period: string
          business_id: string
          cancelled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          mercadopago_payer_id: string | null
          mercadopago_preapproval_id: string | null
          plan_code: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_period?: string
          business_id: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mercadopago_payer_id?: string | null
          mercadopago_preapproval_id?: string | null
          plan_code?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period?: string
          business_id?: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mercadopago_payer_id?: string | null
          mercadopago_preapproval_id?: string | null
          plan_code?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          business_id: string | null
          calendar_color: string | null
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          calendar_color?: string | null
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          calendar_color?: string | null
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      businesses_public_branding: {
        Row: {
          custom_domain: string | null
          custom_subdomain: string | null
          dashboard_display_name: string | null
          dashboard_logo_url: string | null
          dashboard_primary_color: string | null
          id: string | null
          is_private_clinic: boolean | null
          name: string | null
          portal_clinic_display_name: string | null
          portal_dark_primary_color: string | null
          portal_logo_url: string | null
          portal_primary_color: string | null
          portal_theme_preset: string | null
          public_slug: string | null
          shared_calendar: boolean | null
          specialty: string | null
        }
        Insert: {
          custom_domain?: string | null
          custom_subdomain?: string | null
          dashboard_display_name?: string | null
          dashboard_logo_url?: string | null
          dashboard_primary_color?: string | null
          id?: string | null
          is_private_clinic?: boolean | null
          name?: string | null
          portal_clinic_display_name?: string | null
          portal_dark_primary_color?: string | null
          portal_logo_url?: string | null
          portal_primary_color?: string | null
          portal_theme_preset?: string | null
          public_slug?: string | null
          shared_calendar?: boolean | null
          specialty?: string | null
        }
        Update: {
          custom_domain?: string | null
          custom_subdomain?: string | null
          dashboard_display_name?: string | null
          dashboard_logo_url?: string | null
          dashboard_primary_color?: string | null
          id?: string | null
          is_private_clinic?: boolean | null
          name?: string | null
          portal_clinic_display_name?: string | null
          portal_dark_primary_color?: string | null
          portal_logo_url?: string | null
          portal_primary_color?: string | null
          portal_theme_preset?: string | null
          public_slug?: string | null
          shared_calendar?: boolean | null
          specialty?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_add_patient: { Args: { p_business_id: string }; Returns: boolean }
      can_add_professional: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      count_business_active_patients: {
        Args: { p_business_id: string }
        Returns: number
      }
      count_business_professionals: {
        Args: { p_business_id: string }
        Returns: number
      }
      get_plan_limits: {
        Args: { p_plan_code: string }
        Returns: {
          max_patients: number
          max_professionals: number
        }[]
      }
      get_user_business_id: { Args: { _user_id: string }; Returns: string }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      user_belongs_to_business: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      validate_patient_invite: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          id: string
          patient_id: string
          used_at: string
        }[]
      }
      validate_professional_invite: {
        Args: { p_token: string }
        Returns: {
          business_id: string
          email: string
          expires_at: string
          id: string
          name: string
          used_at: string
        }[]
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
