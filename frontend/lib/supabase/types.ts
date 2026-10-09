// utils/supabase/types.ts
// Tipe TypeScript lengkap untuk skema database Supabase Fluxa POS & Business Health Checkup

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'kasir' | 'admin' | 'owner'

type WithTableRelationships<T> = {
  [Name in keyof T]: T[Name] extends {
    Row: infer Row
    Insert: infer Insert
    Update: infer Update
  }
    ? { Row: Row; Insert: Insert; Update: Update; Relationships: [] }
    : T[Name]
}

type WithViewRelationships<T> = {
  [Name in keyof T]: T[Name] extends { Row: infer Row }
    ? { Row: Row; Relationships: [] }
    : T[Name]
}

export interface Database {
  public: {
    Tables: WithTableRelationships<{
      profiles: {
        Row: {
          id: string
          full_name: string
          role: UserRole
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role?: UserRole
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: UserRole
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          category_id: string | null
          name: string
          sku: string | null
          barcode: string | null
          buy_price: number
          sell_price: number
          stock: number
          min_stock: number
          unit: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id?: string | null
          name: string
          sku?: string | null
          barcode?: string | null
          buy_price: number
          sell_price: number
          stock?: number
          min_stock?: number
          unit?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string | null
          name?: string
          sku?: string | null
          barcode?: string | null
          buy_price?: number
          sell_price?: number
          stock?: number
          min_stock?: number
          unit?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          id: string
          cashier_id: string
          opened_at: string
          closed_at: string | null
          initial_cash: number
          final_cash: number | null
          expected_cash: number | null
          difference: number | null
          note: string | null
          status: 'open' | 'closed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cashier_id: string
          opened_at?: string
          closed_at?: string | null
          initial_cash: number
          final_cash?: number | null
          expected_cash?: number | null
          difference?: number | null
          note?: string | null
          status?: 'open' | 'closed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cashier_id?: string
          opened_at?: string
          closed_at?: string | null
          initial_cash?: number
          final_cash?: number | null
          expected_cash?: number | null
          difference?: number | null
          note?: string | null
          status?: 'open' | 'closed'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          id: string
          invoice_number: string
          shift_id: string | null
          cashier_id: string
          customer_id: string | null
          total_amount: number
          discount: number
          final_amount: number
          payment_method: 'cash' | 'qris' | 'transfer' | 'credit'
          payment_status: 'paid' | 'unpaid' | 'partial'
          status: 'completed' | 'voided'
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          shift_id?: string | null
          cashier_id: string
          customer_id?: string | null
          total_amount: number
          discount?: number
          final_amount: number
          payment_method: 'cash' | 'qris' | 'transfer' | 'credit'
          payment_status?: 'paid' | 'unpaid' | 'partial'
          status?: 'completed' | 'voided'
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          shift_id?: string | null
          cashier_id?: string
          customer_id?: string | null
          total_amount?: number
          discount?: number
          final_amount?: number
          payment_method?: 'cash' | 'qris' | 'transfer' | 'credit'
          payment_status?: 'paid' | 'unpaid' | 'partial'
          status?: 'completed' | 'voided'
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          quantity: number
          unit_price: number
          buy_price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          product_id: string
          quantity: number
          unit_price: number
          buy_price: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          buy_price?: number
          subtotal?: number
          created_at?: string
        }
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          type: 'in' | 'out' | 'adjustment' | 'sale' | 'void_return'
          quantity: number
          previous_stock: number
          current_stock: number
          reference_id: string | null
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          type: 'in' | 'out' | 'adjustment' | 'sale' | 'void_return'
          quantity: number
          previous_stock: number
          current_stock: number
          reference_id?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          type?: 'in' | 'out' | 'adjustment' | 'sale' | 'void_return'
          quantity?: number
          previous_stock?: number
          current_stock?: number
          reference_id?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      expense_categories: {
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
      expenses: {
        Row: {
          id: string
          category_id: string | null
          amount: number
          description: string
          expense_date: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id?: string | null
          amount: number
          description: string
          expense_date?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string | null
          amount?: number
          description?: string
          expense_date?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          id: string
          customer_id: string
          sale_id: string | null
          total_amount: number
          paid_amount: number
          remaining_amount: number
          due_date: string | null
          status: 'unpaid' | 'partial' | 'paid'
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          sale_id?: string | null
          total_amount: number
          paid_amount?: number
          due_date?: string | null
          status?: 'unpaid' | 'partial' | 'paid'
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          sale_id?: string | null
          total_amount?: number
          paid_amount?: number
          due_date?: string | null
          status?: 'unpaid' | 'partial' | 'paid'
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      receivable_payments: {
        Row: {
          id: string
          receivable_id: string
          amount: number
          payment_date: string
          payment_method: 'cash' | 'qris' | 'transfer'
          note: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          receivable_id: string
          amount: number
          payment_date?: string
          payment_method: 'cash' | 'qris' | 'transfer'
          note?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          receivable_id?: string
          amount?: number
          payment_date?: string
          payment_method?: 'cash' | 'qris' | 'transfer'
          note?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      checkups: {
        Row: {
          id: string
          period_start: string
          period_end: string
          overall_score: number
          health_status: 'sehat' | 'waspada' | 'kritis'
          revenue: number
          cogs: number
          gross_profit: number
          operating_expenses: number
          net_profit: number
          metrics: Json
          ai_recommendations: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          period_start: string
          period_end: string
          overall_score: number
          health_status: 'sehat' | 'waspada' | 'kritis'
          revenue?: number
          cogs?: number
          gross_profit?: number
          operating_expenses?: number
          net_profit?: number
          metrics?: Json
          ai_recommendations?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          period_start?: string
          period_end?: string
          overall_score?: number
          health_status?: 'sehat' | 'waspada' | 'kritis'
          revenue?: number
          cogs?: number
          gross_profit?: number
          operating_expenses?: number
          net_profit?: number
          metrics?: Json
          ai_recommendations?: string | null
          created_by?: string
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_data: Json | null
          new_data: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          table_name?: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          created_at?: string
        }
      }
    }>
    Views: WithViewRelationships<{
      v_monthly_revenue_cogs: {
        Row: {
          month: string
          total_orders: number
          gross_revenue: number
          cogs: number
          gross_profit: number
        }
      }
      v_daily_sales_summary: {
        Row: {
          sale_date: string
          transaction_count: number
          total_revenue: number
          cash_revenue: number
          non_cash_revenue: number
          credit_revenue: number
        }
      }
      v_low_stock_products: {
        Row: {
          id: string
          name: string
          category_name: string | null
          stock: number
          min_stock: number
          unit: string
          sell_price: number
          is_low_stock: boolean
        }
      }
    }>
    Functions: {
      open_shift: {
        Args: {
          p_initial_cash: number
          p_note?: string | null
        }
        Returns: string
      }
      close_shift: {
        Args: {
          p_shift_id: string
          p_final_cash: number
          p_note?: string | null
        }
        Returns: Json
      }
      create_sale: {
        Args: {
          p_shift_id: string
          p_customer_id: string | null
          p_payment_method: 'cash' | 'qris' | 'transfer' | 'credit'
          p_discount?: number
          p_items: { product_id: string; quantity: number }[] | Json
        }
        Returns: string
      }
      void_sale: {
        Args: {
          p_sale_id: string
          p_reason: string
        }
        Returns: boolean
      }
      current_role: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      is_admin_or_owner: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_owner: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_staff: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
  }
}
