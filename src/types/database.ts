// Database types for Supabase
// Generated based on our schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enum types matching PostgreSQL
export type VolunteerType = 'youth' | 'social'
export type UserRole = 'volunteer' | 'staff' | 'admin' | 'super_admin'
export type UserStatus = 'active' | 'suspended'
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision'
export type PlanStatus = 'active' | 'archived'
export type ProjectStatus = 'active' | 'completed' | 'archived' | 'not_established'
export type ActivityStatus = 'upcoming' | 'ongoing' | 'completed' | 'archived'
export type RegistrationMode = 'direct' | 'approval'
export type RegistrationStatus = 'confirmed' | 'pending' | 'waitlist' | 'cancelled'
export type WorkflowStepType = 'status' | 'approval' | 'establishment'
export type WorkflowStepStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'not_established'
export type ApproverType = 'tag' | 'person'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          volunteer_number: string | null
          type: VolunteerType
          role: UserRole
          name: string
          email: string
          phone: string
          birthday: string
          occupation: string | null
          experience: string | null
          line_id: string | null
          avatar: Json | null
          status: UserStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          volunteer_number?: string | null
          type?: VolunteerType
          role?: UserRole
          name: string
          email: string
          phone: string
          birthday: string
          occupation?: string | null
          experience?: string | null
          line_id?: string | null
          avatar?: Json | null
          status?: UserStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          volunteer_number?: string | null
          type?: VolunteerType
          role?: UserRole
          name?: string
          email?: string
          phone?: string
          birthday?: string
          occupation?: string | null
          experience?: string | null
          line_id?: string | null
          avatar?: Json | null
          status?: UserStatus
          created_at?: string
          updated_at?: string
        }
      }
      admin_tags: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      user_admin_tags: {
        Row: {
          user_id: string
          tag_id: string
          assigned_at: string
        }
        Insert: {
          user_id: string
          tag_id: string
          assigned_at?: string
        }
        Update: {
          user_id?: string
          tag_id?: string
          assigned_at?: string
        }
      }
      volunteer_applications: {
        Row: {
          id: string
          token: string
          name: string
          email: string
          phone: string
          birthday: string
          occupation: string | null
          experience: string | null
          line_id: string | null
          status: ApplicationStatus
          review_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          token?: string
          name: string
          email: string
          phone: string
          birthday: string
          occupation?: string | null
          experience?: string | null
          line_id?: string | null
          status?: ApplicationStatus
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          token?: string
          name?: string
          email?: string
          phone?: string
          birthday?: string
          occupation?: string | null
          experience?: string | null
          line_id?: string | null
          status?: ApplicationStatus
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workflow_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          steps: Json
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          steps?: Json
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          steps?: Json
          created_at?: string
        }
      }
      project_types: {
        Row: {
          id: string
          name: string
          budget_min: number
          budget_max: number
          default_workflow: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          budget_min?: number
          budget_max?: number
          default_workflow?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          budget_min?: number
          budget_max?: number
          default_workflow?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      plans: {
        Row: {
          id: string
          name: string
          description: string | null
          type: string | null
          workflow: Json
          status: PlanStatus
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          type?: string | null
          workflow?: Json
          status?: PlanStatus
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          type?: string | null
          workflow?: Json
          status?: PlanStatus
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          plan_id: string
          name: string
          description: string | null
          project_type: string | null
          budget_amount: number
          result_images: Json | null
          receipt_images: Json | null
          workflow: Json
          current_step: number
          status: ProjectStatus
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          name: string
          description?: string | null
          project_type?: string | null
          budget_amount?: number
          result_images?: Json | null
          receipt_images?: Json | null
          workflow?: Json
          current_step?: number
          status?: ProjectStatus
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          name?: string
          description?: string | null
          project_type?: string | null
          budget_amount?: number
          result_images?: Json | null
          receipt_images?: Json | null
          workflow?: Json
          current_step?: number
          status?: ProjectStatus
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          project_id: string | null
          name: string
          description: string | null
          date: string
          location: string | null
          type: string | null
          cover_image: Json | null
          content_images: Json | null
          capacity: number
          registration_mode: RegistrationMode
          status: ActivityStatus
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          name: string
          description?: string | null
          date: string
          location?: string | null
          type?: string | null
          cover_image?: Json | null
          content_images?: Json | null
          capacity?: number
          registration_mode?: RegistrationMode
          status?: ActivityStatus
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          name?: string
          description?: string | null
          date?: string
          location?: string | null
          type?: string | null
          cover_image?: Json | null
          content_images?: Json | null
          capacity?: number
          registration_mode?: RegistrationMode
          status?: ActivityStatus
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      activity_registrations: {
        Row: {
          id: string
          activity_id: string
          user_id: string
          status: RegistrationStatus
          waitlist_position: number | null
          reviewed_by: string | null
          reviewed_at: string | null
          attended: boolean | null
          service_hours: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          activity_id: string
          user_id: string
          status?: RegistrationStatus
          waitlist_position?: number | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          attended?: boolean | null
          service_hours?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          activity_id?: string
          user_id?: string
          status?: RegistrationStatus
          waitlist_position?: number | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          attended?: boolean | null
          service_hours?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      images: {
        Row: {
          id: string
          original_url: string
          thumbnail_url: string | null
          file_name: string
          file_size: number
          mime_type: string
          sort_order: number
          owner_type: string | null
          owner_id: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          original_url: string
          thumbnail_url?: string | null
          file_name: string
          file_size: number
          mime_type: string
          sort_order?: number
          owner_type?: string | null
          owner_id?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          original_url?: string
          thumbnail_url?: string | null
          file_name?: string
          file_size?: number
          mime_type?: string
          sort_order?: number
          owner_type?: string | null
          owner_id?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
      }
      system_settings: {
        Row: {
          id: string
          youth_age_threshold: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          youth_age_threshold?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          youth_age_threshold?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      profiles_with_tags: {
        Row: {
          id: string
          volunteer_number: string | null
          type: VolunteerType
          role: UserRole
          name: string
          email: string
          phone: string
          birthday: string
          occupation: string | null
          experience: string | null
          line_id: string | null
          avatar: Json | null
          status: UserStatus
          created_at: string
          updated_at: string
          admin_tag_ids: string[]
          admin_tag_names: string[]
        }
      }
      activities_with_counts: {
        Row: {
          id: string
          project_id: string | null
          name: string
          description: string | null
          date: string
          location: string | null
          type: string | null
          cover_image: Json | null
          content_images: Json | null
          capacity: number
          registration_mode: RegistrationMode
          status: ActivityStatus
          created_by: string
          created_at: string
          updated_at: string
          confirmed_count: number
          pending_count: number
          waitlist_count: number
        }
      }
    }
    Functions: {
      setup_initial_admin: {
        Args: {
          admin_user_id: string
          admin_email: string
          admin_name: string
          admin_phone: string
        }
        Returns: void
      }
      approve_volunteer_application: {
        Args: {
          p_application_id: string
          p_reviewer_id: string
          p_note?: string
        }
        Returns: string
      }
      register_for_activity: {
        Args: {
          p_activity_id: string
          p_user_id: string
        }
        Returns: Database['public']['Tables']['activity_registrations']['Row']
      }
      cancel_registration: {
        Args: {
          p_registration_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      advance_project_workflow: {
        Args: {
          p_project_id: string
          p_step_id: string
          p_user_id: string
          p_approved: boolean
          p_note?: string
        }
        Returns: Database['public']['Tables']['projects']['Row']
      }
    }
  }
}
