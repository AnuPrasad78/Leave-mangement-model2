// Hand-authored mirror of backend/supabase/schema.sql for the typed Supabase client.
// Convention notes (verified against schema + existing runtime behavior):
// - `numeric` columns are SELECTed by PostgREST as strings (mappings.js wraps them in
//   Number()) — keep Row fields as `string`, allow `string | number` on Insert values.
// - `date`/`timestamptz` columns are plain strings on the wire.
// - bigint identity columns arrive as numbers.
// Keep in sync with schema.sql; the enums below are the Postgres enums verbatim.
export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string
          auth_user_id: string | null
          emp_no: string
          full_name: string
          initials: string | null
          email: string
          job_title: string | null
          doj: string | null
          account: string | null
          project_name: string | null
          function_name: string | null
          manager_id: string | null
          delivery_partner_name: string | null
          location: string | null
          system_role: 'employee' | 'manager' | 'admin'
          created_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          emp_no?: string
          full_name: string
          initials?: string | null
          email: string
          job_title?: string | null
          doj?: string | null
          account?: string | null
          project_name?: string | null
          function_name?: string | null
          manager_id?: string | null
          delivery_partner_name?: string | null
          location?: string | null
          system_role?: 'employee' | 'manager' | 'admin'
          created_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          emp_no?: string
          full_name?: string
          initials?: string | null
          email?: string
          job_title?: string | null
          doj?: string | null
          account?: string | null
          project_name?: string | null
          function_name?: string | null
          manager_id?: string | null
          delivery_partner_name?: string | null
          location?: string | null
          system_role?: 'employee' | 'manager' | 'admin'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'employees_manager_id_fkey'
            columns: ['manager_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
        ]
      }
      leave_types: {
        Row: {
          id: number
          name: string
          is_active: boolean
        }
        Insert: {
          id?: number
          name: string
          is_active?: boolean
        }
        Update: {
          id?: number
          name?: string
          is_active?: boolean
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          id: number
          request_no: string
          employee_id: string
          leave_type_id: number
          start_date: string
          end_date: string
          days: string
          mode: 'Full Day' | 'First Half' | 'Second Half'
          reason: string
          status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
          approver_id: string | null
          decided_at: string | null
          requested_on: string
          created_at: string
        }
        Insert: {
          id?: number
          request_no?: string
          employee_id: string
          leave_type_id: number
          start_date: string
          end_date: string
          days: string | number
          mode?: 'Full Day' | 'First Half' | 'Second Half'
          reason: string
          status?: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
          approver_id?: string | null
          decided_at?: string | null
          requested_on?: string
          created_at?: string
        }
        Update: {
          id?: number
          request_no?: string
          employee_id?: string
          leave_type_id?: number
          start_date?: string
          end_date?: string
          days?: string | number
          mode?: 'Full Day' | 'First Half' | 'Second Half'
          reason?: string
          status?: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
          approver_id?: string | null
          decided_at?: string | null
          requested_on?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'leave_requests_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leave_requests_approver_id_fkey'
            columns: ['approver_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leave_requests_leave_type_id_fkey'
            columns: ['leave_type_id']
            isOneToOne: false
            referencedRelation: 'leave_types'
            referencedColumns: ['id']
          },
        ]
      }
      leave_balances: {
        Row: {
          id: number
          employee_id: string
          year: number
          opening_annual: string
          annual_credited: string
          annual_utilized: string
          contingency_credited: string
          contingency_utilized: string
          annual_cap: string
          contingency_cap: string
        }
        Insert: {
          id?: number
          employee_id: string
          year: number
          opening_annual?: string | number
          annual_credited?: string | number
          annual_utilized?: string | number
          contingency_credited?: string | number
          contingency_utilized?: string | number
          annual_cap?: string | number
          contingency_cap?: string | number
        }
        Update: {
          id?: number
          employee_id?: string
          year?: number
          opening_annual?: string | number
          annual_credited?: string | number
          annual_utilized?: string | number
          contingency_credited?: string | number
          contingency_utilized?: string | number
          annual_cap?: string | number
          contingency_cap?: string | number
        }
        Relationships: [
          {
            foreignKeyName: 'leave_balances_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
        ]
      }
      holidays: {
        Row: {
          id: number
          country: string
          location: string | null
          year: number
          kind: 'fixed' | 'optional'
          holiday_date: string
          name: string
        }
        Insert: {
          id?: number
          country: string
          location?: string | null
          year: number
          kind: 'fixed' | 'optional'
          holiday_date: string
          name: string
        }
        Update: {
          id?: number
          country?: string
          location?: string | null
          year?: number
          kind?: 'fixed' | 'optional'
          holiday_date?: string
          name?: string
        }
        Relationships: []
      }
      optional_holiday_picks: {
        Row: {
          employee_id: string
          holiday_id: number
          picked_at: string
        }
        Insert: {
          employee_id: string
          holiday_id: number
          picked_at?: string
        }
        Update: {
          employee_id?: string
          holiday_id?: number
          picked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'optional_holiday_picks_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'optional_holiday_picks_holiday_id_fkey'
            columns: ['holiday_id']
            isOneToOne: false
            referencedRelation: 'holidays'
            referencedColumns: ['id']
          },
        ]
      }
      separation_requests: {
        Row: {
          id: number
          employee_id: string
          last_working_day: string
          reason: string
          remarks: string | null
          status: 'Pending' | 'Approved' | 'Rejected'
          reviewed_by: string | null
          decided_at: string | null
          created_at: string
        }
        Insert: {
          id?: number
          employee_id: string
          last_working_day: string
          reason: string
          remarks?: string | null
          status?: 'Pending' | 'Approved' | 'Rejected'
          reviewed_by?: string | null
          decided_at?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          employee_id?: string
          last_working_day?: string
          reason?: string
          remarks?: string | null
          status?: 'Pending' | 'Approved' | 'Rejected'
          reviewed_by?: string | null
          decided_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'separation_requests_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'separation_requests_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      leave_status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
      leave_mode: 'Full Day' | 'First Half' | 'Second Half'
      system_role: 'employee' | 'manager' | 'admin'
      separation_status: 'Pending' | 'Approved' | 'Rejected'
    }
    CompositeTypes: Record<string, never>
  }
}
