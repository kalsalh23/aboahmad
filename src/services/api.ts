import { supabase } from './supabase'
import type {
  Profile,
  Role,
  Permission,
  ResourceCategory,
  Resource,
  ResourceCustomField,
  ResourceCustomFieldValue,
  UnitOfMeasure,
  Branch,
  Department,
  Person,
  Supplier,
  StockBalance,
  StockMovement,
  IndividualAsset,
  AuditLog,
} from '../types'
import { getErrorMessage } from '../utils'

const TABLE = {
  profiles: 'profiles',
  roles: 'roles',
  permissions: 'permissions',
  rolePermissions: 'role_permissions',
  categories: 'resource_categories',
  resources: 'resources',
  units: 'units_of_measure',
  fields: 'resource_custom_fields',
  fieldValues: 'resource_custom_field_values',
  branches: 'branches',
  departments: 'departments',
  people: 'people',
  suppliers: 'suppliers',
  balances: 'stock_balances',
  movements: 'stock_movements',
  assets: 'individual_assets',
  audit: 'audit_logs',
} as const

export interface Result<T> {
  data: T | null
  error: string | null
}

type Query = PromiseLike<any>

async function run<T>(fn: () => Query): Promise<Result<T>> {
  try {
    const { data, error } = await fn()
    if (error) return { data: null, error: getErrorMessage(error) }
    return { data: (data ?? null) as T | null, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}

export const api = {
  auth: {
    async login(identifier: string, password: string): Promise<Result<{ user: any; profile: Profile }>> {
      let profile: Profile | null = null
      const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)

      if (!looksLikeEmail) {
        const res = await run<Profile>(() =>
          supabase
            .from(TABLE.profiles)
            .select('*')
            .or(`username.eq.${identifier},phone.eq.${identifier}`)
            .eq('is_active', true)
            .maybeSingle()
        )
        if (res.error) return { data: null, error: res.error }
        if (!res.data) {
          return { data: null, error: 'اسم المستخدم أو رقم الهاتف غير مسجل في النظام' }
        }
        profile = res.data
      }

      const emailToUse = profile?.email ?? identifier
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      })

      if (error || !data.user) {
        return { data: null, error: error ? getErrorMessage(error) : 'بيانات الدخول غير صحيحة' }
      }

      if (!profile) {
        const res = await run<Profile>(() =>
          supabase.from(TABLE.profiles).select('*').eq('id', data.user.id).maybeSingle()
        )
        if (res.error) return { data: null, error: res.error }
        profile = res.data
      }

      if (!profile) return { data: null, error: 'الحساب غير مرتبط بملف موظف' }
      if (!profile.is_active) {
        await supabase.auth.signOut()
        return { data: null, error: 'الحساب موقوف، راجع مدير النظام' }
      }

      return { data: { user: data.user, profile }, error: null }
    },

    async me(): Promise<Result<Profile>> {
      const { data: authUser } = await supabase.auth.getUser()
      if (!authUser.user) return { data: null, error: null }
      return run<Profile>(() =>
        supabase
          .from(TABLE.profiles)
          .select(`*, role:roles(*), branch:branches(*), department:departments(*)`)
          .eq('id', authUser.user.id)
          .single()
      )
    },

    onAuthChange(cb: (event: string, session: any) => void) {
      return supabase.auth.onAuthStateChange(cb)
    },

    async logout(): Promise<Result<null>> {
      return run<null>(async () => {
        const { error } = await supabase.auth.signOut()
        return { data: null, error }
      })
    },

    hasSession(): boolean {
      return true
    },
  },

  roles: {
    async list(): Promise<Result<Role[]>> {
      return run<Role[]>(() => supabase.from(TABLE.roles).select('*').order('name_ar'))
    },
    async create(input: { name_ar: string; name_en: string; permissions: string[]; description?: string }): Promise<Result<Role>> {
      return run<Role>(async () => {
        const { data: role, error } = await supabase
          .from(TABLE.roles)
          .insert({ name_ar: input.name_ar, name_en: input.name_en, description: input.description ?? null, permissions: input.permissions })
          .select()
          .single()
        if (error) return { data: null, error }
        return { data: role, error: null }
      })
    },
    async update(id: string, input: { name_ar?: string; name_en?: string; permissions?: string[]; description?: string }): Promise<Result<Role>> {
      return run<Role>(() => supabase.from(TABLE.roles).update(input).eq('id', id).select().single())
    },
  },

  permissions: {
    async list(): Promise<Result<Permission[]>> {
      return run<Permission[]>(() => supabase.from(TABLE.permissions).select('*').order('name_ar'))
    },
  },

  users: {
    async list(): Promise<Result<Profile[]>> {
      return run<Profile[]>(() =>
        supabase
          .from(TABLE.profiles)
          .select(`*, role:roles(*), branch:branches(*), department:departments(*)`)
          .order('full_name_ar')
      )
    },
    async update(id: string, input: { role_id?: string; is_active?: boolean; branch_id?: string; department_id?: string }): Promise<Result<Profile>> {
      return run<Profile>(() => supabase.from(TABLE.profiles).update(input).eq('id', id).select().single())
    },
    async create(input: { username?: string; phone?: string; email: string; full_name_ar: string; role_id: string; branch_id?: string; department_id?: string; password: string }): Promise<Result<Profile>> {
      const res = await run<string>(async () => {
        const { data, error } = await supabase.rpc('admin_create_user', {
          p_email: input.email,
          p_password: input.password,
          p_username: input.username ?? null,
          p_phone: input.phone ?? null,
          p_full_name_ar: input.full_name_ar,
          p_role_id: input.role_id,
          p_branch_id: input.branch_id ?? null,
          p_department_id: input.department_id ?? null,
        })
        return { data, error }
      })
      if (res.error) return { data: null, error: res.error }
      if (!res.data) return { data: null, error: 'لم يتم إنشاء المستخدم' }
      return run<Profile>(() => supabase.from(TABLE.profiles).select('*').eq('id', res.data as string).single())
    },
  },

  categories: {
    async list(): Promise<Result<ResourceCategory[]>> {
      return run<ResourceCategory[]>(() =>
        supabase.from(TABLE.categories).select('*').order('sort_order', { ascending: true })
      )
    },
    async create(input: { name_ar: string; name_en?: string; description?: string; sort_order?: number }): Promise<Result<ResourceCategory>> {
      return run<ResourceCategory>(async () => {
        const { data, error } = await supabase
          .from(TABLE.categories)
          .insert({ name_ar: input.name_ar, name_en: input.name_en ?? input.name_ar, description: input.description ?? null, sort_order: input.sort_order ?? 0 })
          .select()
          .single()
        return { data, error }
      })
    },
    async update(id: string, input: Partial<ResourceCategory>): Promise<Result<ResourceCategory>> {
      return run<ResourceCategory>(async () => {
        const { data, error } = await supabase.from(TABLE.categories).update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).select().single()
        return { data, error }
      })
    },
    async setActive(id: string, isActive: boolean): Promise<Result<ResourceCategory>> {
      return api.categories.update(id, { is_active: isActive })
    },
  },

  units: {
    async list(): Promise<Result<UnitOfMeasure[]>> {
      return run<UnitOfMeasure[]>(() => supabase.from(TABLE.units).select('*').order('name_ar'))
    },
    async create(input: { name_ar: string; name_en?: string; symbol_ar?: string }): Promise<Result<UnitOfMeasure>> {
      return run<UnitOfMeasure>(async () => {
        const { data, error } = await supabase.from(TABLE.units).insert({
          name_ar: input.name_ar,
          name_en: input.name_en ?? input.name_ar,
          symbol_ar: input.symbol_ar ?? input.name_ar,
        }).select().single()
        return { data, error }
      })
    },
  },

  resources: {
    async list(filters?: { category_id?: string; is_active?: boolean; only_consumables?: boolean; only_assets?: boolean }): Promise<Result<Resource[]>> {
      return run<Resource[]>(() => {
        let q = supabase.from(TABLE.resources).select('*, category:resource_categories(*), unit:units_of_measure(*)')
        if (filters?.category_id) q = q.eq('category_id', filters.category_id)
        if (filters?.is_active !== undefined) q = q.eq('is_active', filters.is_active)
        if (filters?.only_consumables) q = q.eq('is_consumable', true)
        if (filters?.only_assets) q = q.eq('is_asset', true)
        return q.order('name_ar')
      })
    },
    async listByCategory(categoryId: string): Promise<Result<Resource[]>> {
      return api.resources.list({ category_id: categoryId, is_active: true })
    },
    async create(input: {
      category_id: string
      name_ar: string
      name_en?: string
      unit_id?: string
      is_asset?: boolean
      is_consumable?: boolean
      code?: string
      min_quantity?: number
    }): Promise<Result<Resource>> {
      return run<Resource>(async () => {
        let code = input.code
        if (!code) {
          code = await api.resources.generateCode(input.category_id)
        }
        const { data, error } = await supabase
          .from(TABLE.resources)
          .insert({
            category_id: input.category_id,
            name_ar: input.name_ar,
            name_en: input.name_en ?? input.name_ar,
            unit_id: input.unit_id ?? null,
            is_asset: input.is_asset ?? false,
            is_consumable: input.is_consumable ?? true,
            code: code,
          })
          .select()
          .single()
        if (error) return { data: null, error }
        if (input.min_quantity !== undefined) {
          await supabase.from(TABLE.balances).upsert({ resource_id: data.id, quantity: 0, min_quantity: input.min_quantity }, { onConflict: 'resource_id' })
        }
        return { data, error: null }
      })
    },
    async update(id: string, input: Partial<Resource>): Promise<Result<Resource>> {
      return run<Resource>(async () => {
        const { data, error } = await supabase.from(TABLE.resources).update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).select().single()
        return { data, error }
      })
    },
    async setActive(id: string, isActive: boolean): Promise<Result<Resource>> {
      return api.resources.update(id, { is_active: isActive })
    },
    async generateCode(categoryId: string): Promise<string> {
      const { data } = await supabase.from(TABLE.categories).select('name_ar').eq('id', categoryId).single()
      const letters = (data?.name_ar ?? 'RS').replace(/[^؀-ۿA-Za-z]/g, '').substring(0, 2)
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
      return `${letters || 'RS'}-${rand}`
    },
  },

  fields: {
    async listByResource(resourceId: string): Promise<Result<ResourceCustomField[]>> {
      return run<ResourceCustomField[]>(() =>
        supabase.from(TABLE.fields).select('*').eq('resource_id', resourceId).order('sort_order')
      )
    },
    async listByCategory(categoryId: string): Promise<Result<ResourceCustomField[]>> {
      return run<ResourceCustomField[]>(() =>
        supabase.from(TABLE.fields).select('*').eq('category_id', categoryId).order('sort_order')
      )
    },
    async create(input: {
      resource_id?: string
      category_id?: string
      field_name: string
      field_name_ar: string
      field_type: ResourceCustomField['field_type']
      is_required?: boolean
      options?: string[]
      sort_order?: number
    }): Promise<Result<ResourceCustomField>> {
      return run<ResourceCustomField>(async () => {
        const { data, error } = await supabase.from(TABLE.fields).insert({
          resource_id: input.resource_id ?? null,
          category_id: input.category_id ?? null,
          field_name: input.field_name,
          field_name_ar: input.field_name_ar,
          field_type: input.field_type,
          is_required: input.is_required ?? false,
          options: input.options ?? null,
          sort_order: input.sort_order ?? 0,
        }).select().single()
        return { data, error }
      })
    },
    async remove(id: string): Promise<Result<null>> {
      return run<null>(async () => {
        const { error } = await supabase.from(TABLE.fields).delete().eq('id', id)
        return { data: null, error }
      })
    },
    async saveValues(movementId: string, values: { field_id: string; field_value: string }[]): Promise<Result<null>> {
      if (!values.length) return { data: null, error: null }
      return run<null>(async () => {
        const { error } = await supabase.from(TABLE.fieldValues).insert(
          values.map((v) => ({ movement_id: movementId, field_id: v.field_id, field_value: v.field_value }))
        )
        return { data: null, error }
      })
    },
    async valuesForMovement(movementId: string): Promise<Result<ResourceCustomFieldValue[]>> {
      return run<ResourceCustomFieldValue[]>(() =>
        supabase.from(TABLE.fieldValues).select('*, field:resource_custom_fields(*)').eq('movement_id', movementId)
      )
    },
  },

  branches: {
    async list(): Promise<Result<Branch[]>> {
      return run<Branch[]>(() => supabase.from(TABLE.branches).select('*').order('name_ar'))
    },
    async create(input: { name_ar: string; name_en?: string; location?: string }): Promise<Result<Branch>> {
      return run<Branch>(async () => {
        const { data, error } = await supabase.from(TABLE.branches).insert({
          name_ar: input.name_ar,
          name_en: input.name_en ?? input.name_ar,
          location: input.location ?? null,
        }).select().single()
        return { data, error }
      })
    },
  },

  departments: {
    async list(): Promise<Result<Department[]>> {
      return run<Department[]>(() => supabase.from(TABLE.departments).select('*').order('name_ar'))
    },
    async create(input: { name_ar: string; branch_id?: string }): Promise<Result<Department>> {
      return run<Department>(async () => {
        const { data, error } = await supabase.from(TABLE.departments).insert({
          name_ar: input.name_ar,
          name_en: input.name_ar,
          branch_id: input.branch_id ?? null,
        }).select().single()
        return { data, error }
      })
    },
  },

  people: {
    async list(): Promise<Result<Person[]>> {
      return run<Person[]>(() => supabase.from(TABLE.people).select('*').eq('is_active', true).order('name_ar'))
    },
    async create(input: { name_ar: string; phone?: string; department_id?: string; branch_id?: string; national_id?: string }): Promise<Result<Person>> {
      return run<Person>(async () => {
        const { data, error } = await supabase.from(TABLE.people).insert({
          name_ar: input.name_ar,
          name_en: input.name_ar,
          phone: input.phone ?? null,
          department_id: input.department_id ?? null,
          branch_id: input.branch_id ?? null,
          national_id: input.national_id ?? null,
        }).select().single()
        return { data, error }
      })
    },
    async search(term: string): Promise<Result<Person[]>> {
      return run<Person[]>(() =>
        supabase.from(TABLE.people).select('*').eq('is_active', true).ilike('name_ar', `%${term}%`).limit(20)
      )
    },
  },

  suppliers: {
    async list(): Promise<Result<Supplier[]>> {
      return run<Supplier[]>(() => supabase.from(TABLE.suppliers).select('*').eq('is_active', true).order('name_ar'))
    },
    async create(input: { name_ar: string; contact_person?: string; phone?: string }): Promise<Result<Supplier>> {
      return run<Supplier>(async () => {
        const { data, error } = await supabase.from(TABLE.suppliers).insert({
          name_ar: input.name_ar,
          name_en: input.name_ar,
          contact_person: input.contact_person ?? null,
          phone: input.phone ?? null,
        }).select().single()
        return { data, error }
      })
    },
  },

  balances: {
    async list(): Promise<Result<StockBalance[]>> {
      return run<StockBalance[]>(() =>
        supabase.from(TABLE.balances).select('*, resource:resources(*, category:resource_categories(*), unit:units_of_measure(*)), branch:branches(*)')
      )
    },
    async forResource(resourceId: string): Promise<Result<StockBalance[]>> {
      return run<StockBalance[]>(() => supabase.from(TABLE.balances).select('*').eq('resource_id', resourceId))
    },
    async quantity(resourceId: string): Promise<number> {
      const { data } = await supabase.from(TABLE.balances).select('quantity').eq('resource_id', resourceId).maybeSingle()
      return data?.quantity ?? 0
    },
  },

  movements: {
    async list(filters?: {
      type?: StockMovement['movement_type']
      resource_id?: string
      from?: string
      to?: string
      performed_by?: string
      limit?: number
    }): Promise<Result<StockMovement[]>> {
      return run<StockMovement[]>(() => {
        let q = supabase
          .from(TABLE.movements)
          .select(`
            *,
            resource:resources(*, category:resource_categories(*), unit:units_of_measure(*)),
            performer:profiles!stock_movements_performed_by_fkey(full_name_ar),
            from_branch:branches!stock_movements_from_branch_id_fkey(name_ar),
            to_branch:branches!stock_movements_to_branch_id_fkey(name_ar),
            recipient:people(name_ar)
          `)
          .order('created_at', { ascending: false })
        if (filters?.type) q = q.eq('movement_type', filters.type)
        if (filters?.resource_id) q = q.eq('resource_id', filters.resource_id)
        if (filters?.performed_by) q = q.eq('performed_by', filters.performed_by)
        if (filters?.from) q = q.gte('movement_date', filters.from)
        if (filters?.to) q = q.lte('movement_date', filters.to)
        if (filters?.limit) q = q.limit(filters.limit)
        return q
      })
    },
    async recent(limit = 10): Promise<Result<StockMovement[]>> {
      return api.movements.list({ limit })
    },
    async get(id: string): Promise<Result<StockMovement>> {
      return run<StockMovement>(async () => {
        const { data, error } = await supabase
          .from(TABLE.movements)
          .select(`
            *,
            resource:resources(*, category:resource_categories(*), unit:units_of_measure(*)),
            performer:profiles!stock_movements_performed_by_fkey(full_name_ar),
            from_branch:branches!stock_movements_from_branch_id_fkey(name_ar),
            to_branch:branches!stock_movements_to_branch_id_fkey(name_ar),
            recipient:people(name_ar)
          `)
          .eq('id', id)
          .single()
        return { data, error }
      })
    },
    async receive(input: ReceiveInput): Promise<Result<{ movement_id: string; movement_number: string; new_balance: number }>> {
      const idempotency_key = input.idempotency_key || crypto.randomUUID()
      return run(async () => {
        const { data, error } = await supabase.rpc('create_receipt_movement', {
          p_resource_id: input.resource_id,
          p_quantity: input.quantity,
          p_document_number: input.document_number ?? null,
          p_supplier_name: input.supplier_name ?? null,
          p_reason: input.reason ?? null,
          p_notes: input.notes ?? null,
          p_custom_fields: input.custom_fields ?? {},
          p_idempotency_key: idempotency_key,
        })
        if (error) return { data: null, error }
        const row = Array.isArray(data) ? data[0] : data
        if (!row) return { data: null, error: new Error('لم يتم إنشاء الحركة') }
        return { data: { movement_id: row.movement_id, movement_number: row.movement_number, new_balance: row.new_balance }, error: null }
      })
    },
    async deliver(input: DeliverInput): Promise<Result<{ movement_id: string; movement_number: string; new_balance: number }>> {
      const idempotency_key = input.idempotency_key || crypto.randomUUID()
      return run(async () => {
        const { data, error } = await supabase.rpc('create_delivery_movement', {
          p_resource_id: input.resource_id,
          p_quantity: input.quantity,
          p_recipient_name: input.recipient_name ?? null,
          p_recipient_person_id: input.recipient_person_id ?? null,
          p_branch_id: input.branch_id ?? null,
          p_department_id: input.department_id ?? null,
          p_document_number: input.document_number ?? null,
          p_reason: input.reason ?? null,
          p_notes: input.notes ?? null,
          p_custom_fields: input.custom_fields ?? {},
          p_idempotency_key: idempotency_key,
        })
        if (error) return { data: null, error }
        const row = Array.isArray(data) ? data[0] : data
        if (!row) return { data: null, error: new Error('لم يتم إنشاء الحركة') }
        return { data: { movement_id: row.movement_id, movement_number: row.movement_number, new_balance: row.new_balance }, error: null }
      })
    },
    async cancel(id: string, reason: string): Promise<Result<null>> {
      return run<null>(async () => {
        const { error } = await supabase.rpc('cancel_movement', { p_movement_id: id, p_reason: reason })
        return { data: null, error }
      })
    },
    async history(resourceId: string): Promise<Result<StockMovement[]>> {
      return api.movements.list({ resource_id: resourceId })
    },
  },

  assets: {
    async list(filters?: { status?: string; branch_id?: string }): Promise<Result<IndividualAsset[]>> {
      return run<IndividualAsset[]>(() => {
        let q = supabase.from(TABLE.assets).select('*, resource:resources(*, category:resource_categories(*)), current_branch:branches(*)')
        if (filters?.status) q = q.eq('status', filters.status)
        if (filters?.branch_id) q = q.eq('current_branch_id', filters.branch_id)
        return q.order('asset_number')
      })
    },
    async receive(input: ReceiveAssetInput): Promise<Result<{ asset_id: string; asset_number: string }>> {
      return run(async () => {
        const { data, error } = await supabase.rpc('create_asset_from_receipt', {
          p_resource_id: input.resource_id,
          p_custom_fields: input.custom_fields ?? {},
          p_document_number: input.document_number ?? null,
          p_supplier_name: input.supplier_name ?? null,
        })
        if (error) return { data: null, error }
        const row = Array.isArray(data) ? data[0] : data
        if (!row) return { data: null, error: new Error('لم يتم إنشاء الأصل') }
        return { data: { asset_id: row.asset_id, asset_number: row.asset_number }, error: null }
      })
    },
    async deliver(input: DeliverAssetInput): Promise<Result<null>> {
      return run<null>(async () => {
        const { error } = await supabase.rpc('deliver_asset', {
          p_asset_id: input.asset_id,
          p_recipient_name: input.recipient_name,
          p_branch_id: input.branch_id ?? null,
          p_document_number: input.document_number ?? null,
          p_notes: input.notes ?? null,
        })
        return { data: null, error }
      })
    },
  },

  audit: {
    async list(filters?: { action?: string; from?: string; to?: string; limit?: number }): Promise<Result<AuditLog[]>> {
      return run<AuditLog[]>(() => {
        let q = supabase.from(TABLE.audit).select('*').order('created_at', { ascending: false })
        if (filters?.action) q = q.eq('action', filters.action)
        if (filters?.from) q = q.gte('created_at', filters.from)
        if (filters?.to) q = q.lte('created_at', filters.to)
        if (filters?.limit) q = q.limit(filters.limit)
        return q.limit(filters?.limit ?? 200)
      })
    },
  },

  reports: {
    async stockBalance(filters?: { category_id?: string; branch_id?: string; low_only?: boolean }): Promise<Result<StockBalance[]>> {
      return run<StockBalance[]>(() => {
        let q = supabase
          .from(TABLE.balances)
          .select('*, resource:resources(*, category:resource_categories(*), unit:units_of_measure(*)), branch:branches(*)')
          .order('updated_at', { ascending: false })
        if (filters?.category_id) q = q.eq('resource.category_id', filters.category_id)
        if (filters?.branch_id) q = q.eq('branch_id', filters.branch_id)
        if (filters?.low_only) q = q.lte('quantity', 0)
        return q
      })
    },
    async movementReport(type?: StockMovement['movement_type'], from?: string, to?: string): Promise<Result<StockMovement[]>> {
      return api.movements.list({ type, from, to })
    },
  },
}

export interface ReceiveInput {
  resource_id: string
  quantity: number
  document_number?: string
  supplier_name?: string
  reason?: string
  notes?: string
  custom_fields?: Record<string, string | number>
  idempotency_key?: string
}

export interface DeliverInput {
  resource_id: string
  quantity: number
  recipient_name?: string
  recipient_person_id?: string
  branch_id?: string
  department_id?: string
  document_number?: string
  reason?: string
  notes?: string
  custom_fields?: Record<string, string | number>
  idempotency_key?: string
}

export interface ReceiveAssetInput {
  resource_id: string
  custom_fields?: Record<string, string | number>
  document_number?: string
  supplier_name?: string
}

export interface DeliverAssetInput {
  asset_id: string
  recipient_name: string
  branch_id?: string
  document_number?: string
  notes?: string
}

export default api