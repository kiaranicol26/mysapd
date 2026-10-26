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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      archivo_notas: {
        Row: {
          autor: string | null
          created_at: string
          id: string
          persona_id: string
          texto: string
          updated_at: string
        }
        Insert: {
          autor?: string | null
          created_at?: string
          id?: string
          persona_id: string
          texto: string
          updated_at?: string
        }
        Update: {
          autor?: string | null
          created_at?: string
          id?: string
          persona_id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "archivo_notas_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "archivo_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      archivo_personas: {
        Row: {
          cap_edc: boolean
          cap_m4: boolean
          cap_mary: boolean
          created_at: string
          created_by: string | null
          es_policia: boolean
          foto: string | null
          game_id: string | null
          id: string
          nombre: string
          updated_at: string
          veto_edsa: boolean
          veto_sapd: boolean
          veto_staff: boolean
        }
        Insert: {
          cap_edc?: boolean
          cap_m4?: boolean
          cap_mary?: boolean
          created_at?: string
          created_by?: string | null
          es_policia?: boolean
          foto?: string | null
          game_id?: string | null
          id?: string
          nombre: string
          updated_at?: string
          veto_edsa?: boolean
          veto_sapd?: boolean
          veto_staff?: boolean
        }
        Update: {
          cap_edc?: boolean
          cap_m4?: boolean
          cap_mary?: boolean
          created_at?: string
          created_by?: string | null
          es_policia?: boolean
          foto?: string | null
          game_id?: string | null
          id?: string
          nombre?: string
          updated_at?: string
          veto_edsa?: boolean
          veto_sapd?: boolean
          veto_staff?: boolean
        }
        Relationships: []
      }
      aspirantes: {
        Row: {
          created_at: string
          dp: string | null
          id: string
          instructor: string | null
          nombre: string | null
          notas: string | null
          pasa: string | null
          puntuacion_final: number | null
          puntuacion_seleccion: number | null
          ultima_edicion_por: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          dp?: string | null
          id?: string
          instructor?: string | null
          nombre?: string | null
          notas?: string | null
          pasa?: string | null
          puntuacion_final?: number | null
          puntuacion_seleccion?: number | null
          ultima_edicion_por?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          dp?: string | null
          id?: string
          instructor?: string | null
          nombre?: string | null
          notas?: string | null
          pasa?: string | null
          puntuacion_final?: number | null
          puntuacion_seleccion?: number | null
          ultima_edicion_por?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      discord_verifications: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          discord_id: string
          discord_username: string
          expires_at: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          discord_id: string
          discord_username: string
          expires_at: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          discord_id?: string
          discord_username?: string
          expires_at?: string
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          adjuntos: Json
          contenido: string
          created_at: string
          created_by: string | null
          created_by_id: string | null
          edited_at: string | null
          edited_by: string | null
          id: string
          nota: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          adjuntos?: Json
          contenido?: string
          created_at?: string
          created_by?: string | null
          created_by_id?: string | null
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          nota?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          adjuntos?: Json
          contenido?: string
          created_at?: string
          created_by?: string | null
          created_by_id?: string | null
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          nota?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      instructors: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          can_delete: boolean
          can_edit_files: boolean
          can_edit_pd: boolean
          can_emit_rnap: boolean
          color_perfil: string | null
          created_at: string
          created_by: string | null
          descripcion: string | null
          discord_checked_at: string | null
          discord_id: string | null
          discord_inhabilitado: boolean
          discord_username: string | null
          id: string
          is_alto_mando: boolean
          name: string
          placa: string | null
          pronombres: string | null
          role: string
          secciones: string[]
          sync_avatar: boolean
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          can_delete?: boolean
          can_edit_files?: boolean
          can_edit_pd?: boolean
          can_emit_rnap?: boolean
          color_perfil?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          discord_checked_at?: string | null
          discord_id?: string | null
          discord_inhabilitado?: boolean
          discord_username?: string | null
          id: string
          is_alto_mando?: boolean
          name: string
          placa?: string | null
          pronombres?: string | null
          role?: string
          secciones?: string[]
          sync_avatar?: boolean
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          can_delete?: boolean
          can_edit_files?: boolean
          can_edit_pd?: boolean
          can_emit_rnap?: boolean
          color_perfil?: string | null
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          discord_checked_at?: string | null
          discord_id?: string | null
          discord_inhabilitado?: boolean
          discord_username?: string | null
          id?: string
          is_alto_mando?: boolean
          name?: string
          placa?: string | null
          pronombres?: string | null
          role?: string
          secciones?: string[]
          sync_avatar?: boolean
        }
        Relationships: []
      }
      logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          instructor_id: string | null
          instructor_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
        }
        Relationships: []
      }
      pd_members: {
        Row: {
          cap_air: boolean
          cap_ak47: boolean
          cap_edc: boolean
          cap_m4: boolean
          cap_mary: boolean
          cap_sniper: boolean
          created_at: string
          created_by: string | null
          division: string | null
          division_rango: string | null
          es_instructor: boolean
          foto: string | null
          id: string
          instructor_id: string | null
          nombre: string
          placa: string | null
          rango: string | null
          sueldo_defecto: number
          updated_at: string
        }
        Insert: {
          cap_air?: boolean
          cap_ak47?: boolean
          cap_edc?: boolean
          cap_m4?: boolean
          cap_mary?: boolean
          cap_sniper?: boolean
          created_at?: string
          created_by?: string | null
          division?: string | null
          division_rango?: string | null
          es_instructor?: boolean
          foto?: string | null
          id?: string
          instructor_id?: string | null
          nombre: string
          placa?: string | null
          rango?: string | null
          sueldo_defecto?: number
          updated_at?: string
        }
        Update: {
          cap_air?: boolean
          cap_ak47?: boolean
          cap_edc?: boolean
          cap_m4?: boolean
          cap_mary?: boolean
          cap_sniper?: boolean
          created_at?: string
          created_by?: string | null
          division?: string | null
          division_rango?: string | null
          es_instructor?: boolean
          foto?: string | null
          id?: string
          instructor_id?: string | null
          nombre?: string
          placa?: string | null
          rango?: string | null
          sueldo_defecto?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pd_members_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          created_at: string
          discord: string | null
          id: string
          instructor_asignado: string | null
          motivo: string | null
          nombre_new: string | null
          nombre_old: string | null
          nota_final: string | null
          pasa: string | null
          rango_new: string | null
          rango_old: string | null
          ultima_edicion_por: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          discord?: string | null
          id?: string
          instructor_asignado?: string | null
          motivo?: string | null
          nombre_new?: string | null
          nombre_old?: string | null
          nota_final?: string | null
          pasa?: string | null
          rango_new?: string | null
          rango_old?: string | null
          ultima_edicion_por?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          discord?: string | null
          id?: string
          instructor_asignado?: string | null
          motivo?: string | null
          nombre_new?: string | null
          nombre_old?: string | null
          nota_final?: string | null
          pasa?: string | null
          rango_new?: string | null
          rango_old?: string | null
          ultima_edicion_por?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      rnap_certificates: {
        Row: {
          antecedentes: string | null
          created_at: string
          created_by: string | null
          emitido_fecha: string | null
          emitido_por: string | null
          fecha_nacimiento: string | null
          foto: string | null
          id: string
          nacionalidad: string | null
          nombre_completo: string
          numero_documento: string | null
          tipo_documento: string | null
          updated_at: string
        }
        Insert: {
          antecedentes?: string | null
          created_at?: string
          created_by?: string | null
          emitido_fecha?: string | null
          emitido_por?: string | null
          fecha_nacimiento?: string | null
          foto?: string | null
          id?: string
          nacionalidad?: string | null
          nombre_completo: string
          numero_documento?: string | null
          tipo_documento?: string | null
          updated_at?: string
        }
        Update: {
          antecedentes?: string | null
          created_at?: string
          created_by?: string | null
          emitido_fecha?: string | null
          emitido_por?: string | null
          fecha_nacimiento?: string | null
          foto?: string | null
          id?: string
          nacionalidad?: string | null
          nombre_completo?: string
          numero_documento?: string | null
          tipo_documento?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      salary_entries: {
        Row: {
          created_at: string
          es_instructor: boolean
          id: string
          month_id: string
          nombre: string | null
          nota: string | null
          paga: number
          pagado: boolean
          ultima_edicion_por: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          es_instructor?: boolean
          id?: string
          month_id: string
          nombre?: string | null
          nota?: string | null
          paga?: number
          pagado?: boolean
          ultima_edicion_por?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          es_instructor?: boolean
          id?: string
          month_id?: string
          nombre?: string | null
          nota?: string | null
          paga?: number
          pagado?: boolean
          ultima_edicion_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_entries_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "salary_months"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_months: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
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
