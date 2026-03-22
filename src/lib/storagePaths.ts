export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function buildCompanyStoragePath(params: {
  firmaId: string
  modul: string
  fileName: string
  category?: string | null
}) {
  const safeName = sanitizeFileName(params.fileName)
  const cleanModule = params.modul.replace(/[^a-zA-Z0-9_-]/g, '_')
  const cleanCategory = (params.category || '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const categorySegment = cleanCategory ? `${cleanCategory}/` : ''
  return `${params.firmaId}/${cleanModule}/${categorySegment}${Date.now()}_${safeName}`
}
