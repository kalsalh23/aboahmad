export const BRANCH_CHOICES: { value: string; label: string }[] = [
  { value: 'main', label: 'المستودع الرئيسي' },
]

export const RECEIPT_REASONS = [
  { value: 'purchase', label: 'شراء / توريد' },
  { value: 'grant', label: 'منحة / إعانة' },
  { value: 'return', label: 'إرجاع من فرع' },
  { value: 'transfer_in', label: 'تحويل وارد' },
  { value: 'other', label: 'أخرى' },
]

export const DELIVERY_REASONS = [
  { value: 'custody', label: 'عهدة شخصية' },
  { value: 'branch', label: 'صرف لفرع' },
  { value: 'maintenance', label: 'صيانة' },
  { value: 'transfer_out', label: 'تحويل صادر' },
  { value: 'consumption', label: 'استهلاك تشغيلي' },
]

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  receipt: 'استلام',
  delivery: 'تسليم',
  transfer: 'تحويل',
  adjustment: 'تسوية',
  correction: 'تصحيح',
}

export const ASSET_STATUS_LABELS: Record<string, string> = {
  in_warehouse: 'في المستودع',
  in_use: 'قيد الاستخدام',
  under_maintenance: 'تحت الصيانة',
  retired: 'خارج الخدمة',
}

export const FIELD_TYPES = [
  { value: 'text', label: 'نص' },
  { value: 'number', label: 'رقم' },
  { value: 'date', label: 'تاريخ' },
  { value: 'select', label: 'قائمة اختيار' },
  { value: 'textarea', label: 'نص طويل' },
]