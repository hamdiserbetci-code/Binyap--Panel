'use client'

import { X, Loader2, AlertCircle } from 'lucide-react'
import { useEffect } from 'react'
import type { GorevDurum, IsTip, Oncelik } from '@/types'
import { DURUM_COLOR, DURUM_LABEL, ONCELIK_COLOR, ONCELIK_LABEL, TIP_LABEL } from '@/lib/utils'

// ── Light Ice-Blue Theme Sabitleri ─────────────────────────────────────────
export const cls = {
  input: [
    'w-full rounded-lg border border-blue-200 bg-white',
    'px-3 py-1.5 text-sm font-medium text-slate-700 placeholder:text-slate-400',
    'outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20',
    'transition-all disabled:opacity-40',
  ].join(' '),

  inputSm: [
    'w-full rounded-lg border border-blue-200 bg-white',
    'px-2.5 py-1.5 text-xs font-medium text-slate-700 placeholder:text-slate-400',
    'outline-none focus:border-blue-400 transition-all',
  ].join(' '),

  btnPrimary: [
    'flex items-center justify-center gap-1.5',
    'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
    'text-white px-3.5 py-1.5 rounded-lg text-sm font-semibold',
    'transition-all disabled:opacity-40 disabled:cursor-not-allowed',
    'shadow-sm',
  ].join(' '),

  btnSecondary: [
    'flex items-center justify-center gap-1.5',
    'bg-white hover:bg-slate-50',
    'text-slate-700 px-3.5 py-1.5 rounded-lg text-sm font-semibold',
    'transition-all border border-slate-200',
  ].join(' '),

  btnDanger: [
    'flex items-center justify-center gap-1.5',
    'bg-red-500 hover:bg-red-600',
    'text-white px-3.5 py-1.5 rounded-lg text-sm font-semibold',
    'transition-all',
  ].join(' '),

  btnGhost: [
    'flex items-center justify-center gap-1',
    'text-blue-600 hover:bg-blue-50',
    'px-2 py-1.5 rounded-lg text-sm font-semibold transition-all',
  ].join(' '),

  th: 'text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em] whitespace-nowrap',
  td: 'px-3 py-2 text-sm text-slate-700',
  card: 'rounded-xl border border-blue-100 bg-white shadow-sm',
}

// ── Modal ─────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer, size = 'md' }: {
  title: string; onClose: () => void; children: React.ReactNode
  footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const maxW = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/40 backdrop-blur-[6px]"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`
        bg-white w-full ${maxW[size]}
        rounded-t-[20px] sm:rounded-[20px]
        max-h-[92dvh] flex flex-col
        shadow-xl border border-blue-100
      `}>
        {/* Drag handle (mobil) */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-9 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Başlık */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <h2 className="text-[15px] font-semibold text-slate-800 tracking-tight">{title}</h2>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors">
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* İçerik */}
        <div className={`flex-1 overflow-y-auto p-4 ${!footer ? 'pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4' : ''}`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 border-t border-slate-100 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Field ──────────────────────────────────────────────────────────────────
export function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={11} />{error}
        </p>
      )}
    </div>
  )
}

// ── Loading ────────────────────────────────────────────────────────────────
export function Loading({ text = 'Yükleniyor...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 size={24} className="animate-spin text-blue-500" />
      <span className="text-sm text-slate-500">{text}</span>
    </div>
  )
}

// ── ErrorMsg ──────────────────────────────────────────────────────────────
export function ErrorMsg({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle size={16} className="shrink-0 text-red-500" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-semibold underline text-red-600 hover:text-red-800">
          Tekrar dene
        </button>
      )}
    </div>
  )
}

// ── ConfirmModal ──────────────────────────────────────────────────────────
export function ConfirmModal({ title, message, onConfirm, onCancel, danger = false }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean
}) {
  return (
    <Modal title={title} onClose={onCancel} size="sm"
      footer={
        <>
          <button onClick={onCancel} className={cls.btnSecondary}>İptal</button>
          <button onClick={onConfirm} className={danger ? cls.btnDanger : cls.btnPrimary}>Onayla</button>
        </>
      }>
      <p className="text-sm text-slate-700">{message}</p>
    </Modal>
  )
}

// ── Badge: Durum ──────────────────────────────────────────────────────────
export function DurumBadge({ durum }: { durum: GorevDurum }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${DURUM_COLOR[durum]}`}>
      {DURUM_LABEL[durum]}
    </span>
  )
}

// ── Badge: Öncelik ────────────────────────────────────────────────────────
export function OncelikBadge({ oncelik }: { oncelik: Oncelik }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ONCELIK_COLOR[oncelik]}`}>
      {ONCELIK_LABEL[oncelik]}
    </span>
  )
}

// ── Badge: Tip ────────────────────────────────────────────────────────────
export function TipBadge({ tip }: { tip: IsTip }) {
  const colors: Record<IsTip, string> = {
    beyanname: 'bg-purple-100 text-purple-700',
    odeme:     'bg-amber-100 text-amber-700',
    bordro:    'bg-blue-100 text-blue-700',
    mutabakat: 'bg-cyan-100 text-cyan-700',
    edefter:   'bg-indigo-100 text-indigo-700',
    diger:     'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${colors[tip]}`}>
      {TIP_LABEL[tip]}
    </span>
  )
}

// ── Kalan Gün ─────────────────────────────────────────────────────────────
export function KalanGunBadge({ gun }: { gun: number }) {
  if (gun < 0)   return <span className="text-xs font-semibold text-red-600">{Math.abs(gun)} gün gecikti</span>
  if (gun === 0) return <span className="text-xs font-semibold text-red-600">Bugün!</span>
  if (gun <= 3)  return <span className="text-xs font-semibold text-amber-600">{gun} gün kaldı</span>
  return <span className="text-xs text-slate-400">{gun} gün kaldı</span>
}

// ── Empty State ───────────────────────────────────────────────────────────
export function Empty({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-blue-50 border border-blue-100">
        <Icon size={28} className="text-blue-300" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
