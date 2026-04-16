'use client'
import React from 'react'

// ─── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin ${className}`} />
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange'
const badgeColors: Record<BadgeVariant, string> = {
  green:  'bg-green-100 text-green-800',
  red:    'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue:   'bg-blue-100 text-blue-800',
  gray:   'bg-gray-100 text-gray-700',
  orange: 'bg-orange-100 text-orange-800',
}
export function Badge({ label, variant = 'gray' }: { label: string; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${badgeColors[variant]}`}>
      {label}
    </span>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
const btnStyles: Record<BtnVariant, string> = {
  primary:   'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  danger:    'bg-red-600 text-white hover:bg-red-700',
  ghost:     'text-gray-600 hover:bg-gray-100',
}
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: 'sm' | 'md'
  icon?: React.ReactNode
}
export function Btn({ variant = 'primary', size = 'md', icon, children, className = '', ...rest }: BtnProps) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  return (
    <button
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sz} ${btnStyles[variant]} ${className}`}
      {...rest}
    >
      {icon && <span className="w-4 h-4 flex-shrink-0">{icon}</span>}
      {children}
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  color?: string
  onClick?: () => void
}
export function StatCard({ label, value, sub, icon, color = 'text-blue-600', onClick }: StatCardProps) {
  return (
    <Card className={`p-3 sm:p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow active:scale-95' : ''}`}>
      <div className="flex items-start justify-between" onClick={onClick}>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1 truncate">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
        </div>
        {icon && <div className={`${color} opacity-80 flex-shrink-0 ml-2`}>{icon}</div>}
      </div>
    </Card>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}
const modalSizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }
export function Modal({ title, onClose, children, footer, size = 'md' }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className={`bg-white w-full ${modalSizes[size]} max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl rounded-t-2xl sm:rounded-xl modal-mobile-full`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 flex-shrink-0">
          {/* Mobil drag handle */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-300 rounded-full sm:hidden" />
          <h2 className="text-base sm:text-lg font-bold text-gray-900 pr-4">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex-shrink-0 bg-gray-50 rounded-b-xl safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────
export function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <Btn variant="secondary" onClick={onCancel}>İptal</Btn>
          <Btn variant="danger" onClick={onConfirm}>Sil</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── FormField ────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string
  required?: boolean
  children: React.ReactNode
  className?: string
}
export function Field({ label, required, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
export const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

// ─── PageHeader ───────────────────────────────────────────────────────────────
interface PageHeaderProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
  iconBg?: string
}
export function PageHeader({ icon, title, subtitle, action, iconBg = 'bg-blue-50' }: PageHeaderProps) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 sm:p-2.5 ${iconBg} rounded-xl flex-shrink-0`}>{icon}</div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">{title}</h1>
            {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5 hidden sm:block">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </Card>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="mb-3 opacity-40">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ─── formatCurrency / formatDate ─────────────────────────────────────────────
export function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(n)
}
export function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString('tr-TR') : '-'
}
