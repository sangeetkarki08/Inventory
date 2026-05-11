// =============================================================================
//  types/database.types.ts
//
//  Domain types layered on top of the auto-generated Supabase types.
//  The Database type itself is imported directly from supabase.generated.ts
//  by the Supabase clients — we don't re-alias it here because that aliasing
//  was confusing TypeScript's type resolution.
// =============================================================================

import type { Database } from './supabase.generated';

// Convenience aliases for the deeply-nested generated row types.
type T = Database['public']['Tables'];
type V = Database['public']['Views'];

// ─── Enums ───────────────────────────────────────────────────────────────────
export type UserRole          = 'Admin' | 'Store Manager';
export type ItemCategory      = 'Consumable' | 'Tools' | 'Equipment' | 'Spare Parts';
export type ItemUnit          = 'Nos'|'Pcs'|'Kg'|'Ltr'|'Mtr'|'Box'|'Set'|'Roll'|'Bag'|'Ton'|'Pair'|'Sheet'|'Cu.m'|'Sq.m';
export type IssueType         = 'Consumption' | 'Transfer' | 'Tool Issue' | 'Return';
export type SiteType          = 'Main Store' | 'Site' | 'Subcontractor' | 'Individual';
export type EquipmentCategory = 'Excavator'|'Crane'|'Bulldozer'|'Concrete Mixer'|'Vibrator'|'Generator'|'Compressor'|'Water Pump'|'Scaffold'|'Bar Cutter'|'Welding Machine'|'Other';
export type EquipmentStatus   = 'Active' | 'Under Repair' | 'Idle' | 'Retired';
export type ProjectStatus     = 'Active' | 'On Hold' | 'Completed' | 'Cancelled';
export type PoStatus          = 'Draft' | 'Sent' | 'Partially Received' | 'Received' | 'Cancelled';
export type StockStatus       = 'OUT_OF_STOCK' | 'LOW' | 'OK';

// ─── Branded ID types ───────────────────────────────────────────────────────
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type CompanyId   = Brand<number, 'CompanyId'>;
export type ProjectId   = Brand<number, 'ProjectId'>;
export type SiteId      = Brand<number, 'SiteId'>;
export type EquipmentId = Brand<number, 'EquipmentId'>;
export type ItemId      = Brand<number, 'ItemId'>;
export type StockInId   = Brand<number, 'StockInId'>;
export type StockOutId  = Brand<number, 'StockOutId'>;
export type PoId        = Brand<number, 'PoId'>;
export type ProfileId   = Brand<string, 'ProfileId'>;

// ─── Row types (re-export with our nice names) ──────────────────────────────
export type ProfileRow            = T['profiles']['Row'];
export type CompanyRow            = T['companies']['Row'];
export type ProjectRow            = T['projects']['Row'];
export type SiteRow               = T['sites']['Row'];
export type EquipmentRow          = T['equipment']['Row'];
export type ItemRow               = T['items']['Row'];
export type StockInRow            = T['stock_in']['Row'];
export type StockOutRow           = T['stock_out']['Row'];
export type StockOutBatchRow      = T['stock_out_batches']['Row'];
export type PurchaseOrderRow      = T['purchase_orders']['Row'];
export type PurchaseOrderLineRow  = T['purchase_order_lines']['Row'];
export type ItemStockView         = V['v_item_stock']['Row'];

// ─── Insert / Update DTOs ────────────────────────────────────────────────────
export type CompanyInsert            = T['companies']['Insert'];
export type ProjectInsert            = T['projects']['Insert'];
export type SiteInsert               = T['sites']['Insert'];
export type EquipmentInsert          = T['equipment']['Insert'];
export type ItemInsert               = T['items']['Insert'];
export type StockInInsert            = T['stock_in']['Insert'];
export type PurchaseOrderInsert      = T['purchase_orders']['Insert'];
export type PurchaseOrderLineInsert  = T['purchase_order_lines']['Insert'];

// ─── RPC contract for process_stock_out ──────────────────────────────────────
export interface ProcessStockOutArgs {
  p_item_id: number;
  p_quantity: number;
  p_site_id: number;
  p_issue_type: IssueType;
  p_issued_at: string;
  p_description?: string | null;
}

export interface FifoBatchBreakdown {
  stock_in_id: StockInId;
  quantity: number;
  unit_rate: number;
}

export interface ProcessStockOutResult {
  stock_out_id: StockOutId;
  total_cost: number;
  breakdown: FifoBatchBreakdown[];
}
