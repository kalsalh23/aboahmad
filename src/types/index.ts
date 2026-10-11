export interface Profile {
  id: string
  email?: string
  phone?: string
  username?: string
  full_name_ar?: string
  full_name_en?: string
  role_id?: string
  branch_id?: string
  department_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
  role?: Role
  branch?: Branch
  department?: Department
}

export interface Role {
  id: string
  name_ar: string
  name_en: string
  description?: string
  permissions: string[]
  created_at: string
}

export interface Permission {
  id: string
  name: string
  name_ar: string
  description?: string
}

export interface ResourceCategory {
  id: string
  name_ar: string
  name_en: string
  description?: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface UnitOfMeasure {
  id: string
  name_ar: string
  name_en: string
  symbol_ar?: string
  symbol_en?: string
  category?: string
  is_active: boolean
  created_at: string
}

export interface Resource {
  id: string
  category_id: string
  name_ar: string
  name_en: string
  code?: string
  unit_id?: string
  unit_ar?: string
  is_asset: boolean
  is_consumable: boolean
  is_active: boolean
  default_custom_fields?: Record<string, any>
  created_at: string
  updated_at: string
  category?: ResourceCategory
  unit?: UnitOfMeasure
}

export interface ResourceCustomField {
  id: string
  resource_id: string
  field_name: string
  field_name_ar: string
  field_type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox'
  is_required: boolean
  options?: string[]
  sort_order: number
  created_at: string
}

export interface ResourceCustomFieldValue {
  id: string
  movement_id?: string
  asset_id?: string
  field_id: string
  field_value: string
  created_at: string
}

export type CustomValues = Record<string, string>

export interface Branch {
  id: string
  name_ar: string
  name_en: string
  code?: string
  location?: string
  is_active: boolean
  created_at: string
}

export interface Department {
  id: string
  name_ar: string
  name_en: string
  branch_id?: string
  is_active: boolean
  created_at: string
}

export interface Person {
  id: string
  name_ar: string
  name_en: string
  national_id?: string
  phone?: string
  department_id?: string
  branch_id?: string
  is_active: boolean
  created_at: string
}

export interface StockBalance {
  id: string
  resource_id: string
  branch_id?: string
  quantity: number
  reserved_quantity: number
  min_quantity: number
  updated_at: string
  resource?: Resource
  branch?: Branch
}

export interface StockMovement {
  id: string
  movement_number: string
  movement_type: 'receipt' | 'delivery' | 'transfer' | 'adjustment' | 'correction'
  resource_id: string
  quantity: number
  unit_id?: string
  branch_id?: string
  from_branch_id?: string
  to_branch_id?: string
  to_branch_name?: string
  from_branch_name?: string
  recipient_person_id?: string
  recipient_name?: string
  recipient_department_id?: string
  recipient_branch_id?: string
  supplier_id?: string
  supplier_name?: string
  document_number?: string
  document_type?: string
  reason?: string
  notes?: string
  performed_by: string
  approved_by?: string
  status: 'pending' | 'approved' | 'completed' | 'cancelled'
  movement_date: string
  created_at: string
  updated_at: string
  resource?: Resource
  performer?: Profile
  recipient?: Person
  from_branch?: Branch
  to_branch?: Branch
  unit?: UnitOfMeasure
}

export interface IndividualAsset {
  id: string
  asset_number: string
  resource_id: string
  serial_number?: string
  model?: string
  manufacturer?: string
  plate_number?: string
  chassis_number?: string
  status: 'in_warehouse' | 'in_use' | 'under_maintenance' | 'retired'
  current_branch_id?: string
  current_location?: string
  condition_notes?: string
  acquisition_date?: string
  created_at: string
  updated_at: string
  resource?: Resource
  current_branch?: Branch
}

export interface ReceivingDocument {
  id: string
  document_number: string
  movement_id?: string
  resource_id: string
  quantity: number
  supplier_id?: string
  supplier_name?: string
  document_date: string
  received_by: string
  notes?: string
  created_at: string
}

export interface DeliveryDocument {
  id: string
  document_number: string
  movement_id?: string
  resource_id: string
  quantity: number
  recipient_person_id?: string
  recipient_name?: string
  recipient_branch_id?: string
  recipient_department_id?: string
  delivery_date: string
  delivered_by: string
  notes?: string
  created_at: string
}

export interface AuditLog {
  id: string
  user_id?: string
  action: string
  entity_type: string
  entity_id?: string
  old_values?: Record<string, any>
  new_values?: Record<string, any>
  ip_address?: string
  user_agent?: string
  created_at: string
}

export interface Supplier {
  id: string
  name_ar: string
  name_en: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  is_active: boolean
  created_at: string
}

export type MovementType = 'receipt' | 'delivery' | 'transfer' | 'adjustment' | 'correction'
export type MovementStatus = 'pending' | 'approved' | 'completed' | 'cancelled'
export type AssetStatus = 'in_warehouse' | 'in_use' | 'under_maintenance' | 'retired'

export interface DashboardStats {
  total_resources: number
  total_categories: number
  low_stock_items: number
  total_assets: number
  recent_movements: number
}