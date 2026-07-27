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
      attendance: {
        Row: {
          created_at: string
          date: string
          group_id: string | null
          id: string
          note: string | null
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          group_id?: string | null
          id?: string
          note?: string | null
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          date?: string
          group_id?: string | null
          id?: string
          note?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_answers: {
        Row: {
          answer: Json | null
          attempt_id: string
          created_at: string
          feedback: string | null
          id: string
          is_correct: boolean | null
          question_id: string
          score: number
          time_spent_seconds: number
        }
        Insert: {
          answer?: Json | null
          attempt_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          question_id: string
          score?: number
          time_spent_seconds?: number
        }
        Update: {
          answer?: Json | null
          attempt_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
          score?: number
          time_spent_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          analysis: string | null
          attempt_no: number
          created_at: string
          exam_id: string
          id: string
          max_score: number
          percentage: number
          remedial_plan: string | null
          score: number
          started_at: string
          status: string
          strengths: Json
          student_id: string
          submitted_at: string | null
          time_spent_seconds: number
          weaknesses: Json
        }
        Insert: {
          analysis?: string | null
          attempt_no?: number
          created_at?: string
          exam_id: string
          id?: string
          max_score?: number
          percentage?: number
          remedial_plan?: string | null
          score?: number
          started_at?: string
          status?: string
          strengths?: Json
          student_id: string
          submitted_at?: string | null
          time_spent_seconds?: number
          weaknesses?: Json
        }
        Update: {
          analysis?: string | null
          attempt_no?: number
          created_at?: string
          exam_id?: string
          id?: string
          max_score?: number
          percentage?: number
          remedial_plan?: string | null
          score?: number
          started_at?: string
          status?: string
          strengths?: Json
          student_id?: string
          submitted_at?: string | null
          time_spent_seconds?: number
          weaknesses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer: Json | null
          created_at: string
          difficulty: string
          distractor_explanations: Json
          exam_id: string
          expected_seconds: number
          id: string
          kind: string
          learning_outcome: string | null
          options: Json
          passage: string | null
          position: number
          prompt: string
          rationale: string | null
          score: number
          skill: string | null
          source_ref: string | null
        }
        Insert: {
          correct_answer?: Json | null
          created_at?: string
          difficulty?: string
          distractor_explanations?: Json
          exam_id: string
          expected_seconds?: number
          id?: string
          kind?: string
          learning_outcome?: string | null
          options?: Json
          passage?: string | null
          position?: number
          prompt: string
          rationale?: string | null
          score?: number
          skill?: string | null
          source_ref?: string | null
        }
        Update: {
          correct_answer?: Json | null
          created_at?: string
          difficulty?: string
          distractor_explanations?: Json
          exam_id?: string
          expected_seconds?: number
          id?: string
          kind?: string
          learning_outcome?: string | null
          options?: Json
          passage?: string | null
          position?: number
          prompt?: string
          rationale?: string | null
          score?: number
          skill?: string | null
          source_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          adaptive: boolean
          created_at: string
          difficulty: string
          duration_minutes: number
          grade: string | null
          group_id: string | null
          id: string
          lesson: string | null
          notes: string | null
          question_count: number
          question_types: string[]
          sources: Json
          status: string
          subject: string | null
          term: string | null
          title: string
          total_score: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          adaptive?: boolean
          created_at?: string
          difficulty?: string
          duration_minutes?: number
          grade?: string | null
          group_id?: string | null
          id?: string
          lesson?: string | null
          notes?: string | null
          question_count?: number
          question_types?: string[]
          sources?: Json
          status?: string
          subject?: string | null
          term?: string | null
          title: string
          total_score?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          adaptive?: boolean
          created_at?: string
          difficulty?: string
          duration_minutes?: number
          grade?: string | null
          group_id?: string | null
          id?: string
          lesson?: string | null
          notes?: string | null
          question_count?: number
          question_types?: string[]
          sources?: Json
          status?: string
          subject?: string | null
          term?: string | null
          title?: string
          total_score?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          color: string | null
          created_at: string
          days: string | null
          grade: string | null
          id: string
          max_students: number | null
          monthly_fee: number
          name: string
          room: string | null
          subject: string | null
          teacher_name: string | null
          time: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          days?: string | null
          grade?: string | null
          id?: string
          max_students?: number | null
          monthly_fee?: number
          name: string
          room?: string | null
          subject?: string | null
          teacher_name?: string | null
          time?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          days?: string | null
          grade?: string | null
          id?: string
          max_students?: number | null
          monthly_fee?: number
          name?: string
          room?: string | null
          subject?: string | null
          teacher_name?: string | null
          time?: string | null
        }
        Relationships: []
      }
      homework: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          group_id: string | null
          id: string
          max_score: number | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          max_score?: number | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          group_id?: string | null
          id?: string
          max_score?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          answer_text: string | null
          file_url: string | null
          homework_id: string
          id: string
          note: string | null
          score: number | null
          status: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          answer_text?: string | null
          file_url?: string | null
          homework_id: string
          id?: string
          note?: string | null
          score?: number | null
          status?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          answer_text?: string | null
          file_url?: string | null
          homework_id?: string
          id?: string
          note?: string | null
          score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          group_id: string | null
          id: string
          kind: string
          method: string | null
          month: string | null
          note: string | null
          paid_at: string
          student_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          group_id?: string | null
          id?: string
          kind?: string
          method?: string | null
          month?: string | null
          note?: string | null
          paid_at?: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string | null
          id?: string
          kind?: string
          method?: string | null
          month?: string | null
          note?: string | null
          paid_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          body: string
          created_at: string
          id: string
          is_read: boolean
          student_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          student_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          student_id?: string
        }
        Relationships: []
      }
      student_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          student_id: string
          title: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          student_id: string
          title?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          student_id?: string
          title?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          active: boolean
          address: string | null
          birth_date: string | null
          code: string
          created_at: string
          education_dept: string | null
          full_name: string
          gender: string | null
          governorate: string | null
          grade: string | null
          group_id: string | null
          id: string
          national_id: string | null
          notes: string | null
          parent_phone: string | null
          phone: string | null
          photo_url: string | null
          registration_date: string | null
          school: string | null
          section: string | null
          subject: string | null
          teacher_name: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          birth_date?: string | null
          code?: string
          created_at?: string
          education_dept?: string | null
          full_name: string
          gender?: string | null
          governorate?: string | null
          grade?: string | null
          group_id?: string | null
          id?: string
          national_id?: string | null
          notes?: string | null
          parent_phone?: string | null
          phone?: string | null
          photo_url?: string | null
          registration_date?: string | null
          school?: string | null
          section?: string | null
          subject?: string | null
          teacher_name?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          birth_date?: string | null
          code?: string
          created_at?: string
          education_dept?: string | null
          full_name?: string
          gender?: string | null
          governorate?: string | null
          grade?: string | null
          group_id?: string | null
          id?: string
          national_id?: string | null
          notes?: string | null
          parent_phone?: string | null
          phone?: string | null
          photo_url?: string | null
          registration_date?: string | null
          school?: string | null
          section?: string | null
          subject?: string | null
          teacher_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
    }
    Functions: {
      claim_teacher_role: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_teacher: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "teacher" | "admin"
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
      app_role: ["teacher", "admin"],
    },
  },
} as const
