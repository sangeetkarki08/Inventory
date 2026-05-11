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
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: number
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category: Database["public"]["Enums"]["equipment_category"]
          created_at: string
          created_by: string | null
          id: number
          model: string | null
          name: string
          notes: string | null
          serial_no: string | null
          site_id: number | null
          status: Database["public"]["Enums"]["equipment_status"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["equipment_category"]
          created_at?: string
          created_by?: string | null
          id?: number
          model?: string | null
          name: string
          notes?: string | null
          serial_no?: string | null
          site_id?: number | null
          status?: Database["public"]["Enums"]["equipment_status"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["equipment_category"]
          created_at?: string
          created_by?: string | null
          id?: number
          model?: string | null
          name?: string
          notes?: string | null
          serial_no?: string | null
          site_id?: number | null
          status?: Database["public"]["Enums"]["equipment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          created_at: string
          created_by: string | null
          description: string | null
          equipment_id: number | null
          id: number
          is_active: boolean
          max_level: number
          name: string
          preferred_supplier: string | null
          reorder_level: number
          unit: Database["public"]["Enums"]["item_unit"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["item_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_id?: number | null
          id?: number
          is_active?: boolean
          max_level?: number
          name: string
          preferred_supplier?: string | null
          reorder_level?: number
          unit: Database["public"]["Enums"]["item_unit"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_id?: number | null
          id?: number
          is_active?: boolean
          max_level?: number
          name?: string
          preferred_supplier?: string | null
          reorder_level?: number
          unit?: Database["public"]["Enums"]["item_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          company_id: number
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: number
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          company_id: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: number
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          company_id?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: number
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          id: number
          item_id: number
          line_total: number | null
          purchase_order_id: number
          quantity: number
          unit_rate: number
        }
        Insert: {
          id?: number
          item_id: number
          line_total?: number | null
          purchase_order_id: number
          quantity: number
          unit_rate: number
        }
        Update: {
          id?: number
          item_id?: number
          line_total?: number | null
          purchase_order_id?: number
          quantity?: number
          unit_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_stock"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_at: string | null
          id: number
          notes: string | null
          ordered_at: string
          po_number: string
          status: Database["public"]["Enums"]["po_status"]
          supplier: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: number
          notes?: string | null
          ordered_at?: string
          po_number: string
          status?: Database["public"]["Enums"]["po_status"]
          supplier: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: number
          notes?: string | null
          ordered_at?: string
          po_number?: string
          status?: Database["public"]["Enums"]["po_status"]
          supplier?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: number
          name: string
          project_id: number | null
          type: Database["public"]["Enums"]["site_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: number
          name: string
          project_id?: number | null
          type: Database["public"]["Enums"]["site_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: number
          name?: string
          project_id?: number | null
          type?: Database["public"]["Enums"]["site_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_in: {
        Row: {
          base_amount: number | null
          created_at: string
          description: string | null
          id: number
          item_id: number
          project_id: number | null
          quantity: number
          received_at: string
          received_by: string | null
          remaining_quantity: number
          supplier: string | null
          total_with_vat: number | null
          unit_rate: number
          updated_at: string
          vat_amount: number | null
          vat_rate: number
        }
        Insert: {
          base_amount?: number | null
          created_at?: string
          description?: string | null
          id?: number
          item_id: number
          project_id?: number | null
          quantity: number
          received_at?: string
          received_by?: string | null
          remaining_quantity: number
          supplier?: string | null
          total_with_vat?: number | null
          unit_rate: number
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number
        }
        Update: {
          base_amount?: number | null
          created_at?: string
          description?: string | null
          id?: number
          item_id?: number
          project_id?: number | null
          quantity?: number
          received_at?: string
          received_by?: string | null
          remaining_quantity?: number
          supplier?: string | null
          total_with_vat?: number | null
          unit_rate?: number
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_in_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_in_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_stock"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "stock_in_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_in_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_out: {
        Row: {
          created_at: string
          description: string | null
          id: number
          issue_type: Database["public"]["Enums"]["issue_type"]
          issued_at: string
          issued_by: string | null
          item_id: number
          quantity: number
          site_id: number
          total_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          issue_type: Database["public"]["Enums"]["issue_type"]
          issued_at?: string
          issued_by?: string | null
          item_id: number
          quantity: number
          site_id: number
          total_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          issue_type?: Database["public"]["Enums"]["issue_type"]
          issued_at?: string
          issued_by?: string | null
          item_id?: number
          quantity?: number
          site_id?: number
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_out_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_out_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_out_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_stock"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "stock_out_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_out_batches: {
        Row: {
          created_at: string
          id: number
          quantity_consumed: number
          stock_in_id: number
          stock_out_id: number
          unit_rate_at_consumption: number
        }
        Insert: {
          created_at?: string
          id?: number
          quantity_consumed: number
          stock_in_id: number
          stock_out_id: number
          unit_rate_at_consumption: number
        }
        Update: {
          created_at?: string
          id?: number
          quantity_consumed?: number
          stock_in_id?: number
          stock_out_id?: number
          unit_rate_at_consumption?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_out_batches_stock_in_id_fkey"
            columns: ["stock_in_id"]
            isOneToOne: false
            referencedRelation: "stock_in"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_out_batches_stock_out_id_fkey"
            columns: ["stock_out_id"]
            isOneToOne: false
            referencedRelation: "stock_out"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_item_stock: {
        Row: {
          category: Database["public"]["Enums"]["item_category"] | null
          current_quantity: number | null
          current_value: number | null
          equipment_id: number | null
          item_id: number | null
          max_level: number | null
          name: string | null
          reorder_level: number | null
          stock_status: string | null
          unit: Database["public"]["Enums"]["item_unit"] | null
        }
        Relationships: [
          {
            foreignKeyName: "items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      process_stock_out: {
        Args: {
          p_description?: string
          p_issue_type: Database["public"]["Enums"]["issue_type"]
          p_issued_at: string
          p_item_id: number
          p_quantity: number
          p_site_id: number
        }
        Returns: Json
      }
    }
    Enums: {
      equipment_category:
        | "Excavator"
        | "Crane"
        | "Bulldozer"
        | "Concrete Mixer"
        | "Vibrator"
        | "Generator"
        | "Compressor"
        | "Water Pump"
        | "Scaffold"
        | "Bar Cutter"
        | "Welding Machine"
        | "Other"
      equipment_status: "Active" | "Under Repair" | "Idle" | "Retired"
      issue_type: "Consumption" | "Transfer" | "Tool Issue" | "Return"
      item_category: "Consumable" | "Tools" | "Equipment" | "Spare Parts"
      item_unit:
        | "Nos"
        | "Pcs"
        | "Kg"
        | "Ltr"
        | "Mtr"
        | "Box"
        | "Set"
        | "Roll"
        | "Bag"
        | "Ton"
        | "Pair"
        | "Sheet"
        | "Cu.m"
        | "Sq.m"
      po_status:
        | "Draft"
        | "Sent"
        | "Partially Received"
        | "Received"
        | "Cancelled"
      project_status: "Active" | "On Hold" | "Completed" | "Cancelled"
      site_type: "Main Store" | "Site" | "Subcontractor" | "Individual"
      user_role: "Admin" | "Store Manager"
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
      equipment_category: [
        "Excavator",
        "Crane",
        "Bulldozer",
        "Concrete Mixer",
        "Vibrator",
        "Generator",
        "Compressor",
        "Water Pump",
        "Scaffold",
        "Bar Cutter",
        "Welding Machine",
        "Other",
      ],
      equipment_status: ["Active", "Under Repair", "Idle", "Retired"],
      issue_type: ["Consumption", "Transfer", "Tool Issue", "Return"],
      item_category: ["Consumable", "Tools", "Equipment", "Spare Parts"],
      item_unit: [
        "Nos",
        "Pcs",
        "Kg",
        "Ltr",
        "Mtr",
        "Box",
        "Set",
        "Roll",
        "Bag",
        "Ton",
        "Pair",
        "Sheet",
        "Cu.m",
        "Sq.m",
      ],
      po_status: [
        "Draft",
        "Sent",
        "Partially Received",
        "Received",
        "Cancelled",
      ],
      project_status: ["Active", "On Hold", "Completed", "Cancelled"],
      site_type: ["Main Store", "Site", "Subcontractor", "Individual"],
      user_role: ["Admin", "Store Manager"],
    },
  },
} as const
