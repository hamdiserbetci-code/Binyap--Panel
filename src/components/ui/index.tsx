'use client'

import { X, Loader2, AlertCircle } from 'lucide-react'
import { useEffect } from 'react'
import type { GorevDurum, IsTip, Oncelik } from '@/types'
import { DURUM_COLOR, DURUM_LABEL, ONCELIK_COLOR, ONCELIK_LABEL, TIP_LABEL } from '@/lib/utils'

// ── iOS Stil Sabitleri ─────────────────────────────────────────────────────
export const cls = {
  input: [
    'w-full rounded-xl border border-[rgba(168,185,212,0.2)] bg-[rgba(8,18,34,0.84)]',
    'px-3.5 py-2.5 text-sm font-medium text-[rgba(245,247,251,0.96)] placeholder:text-[rgba(230,236,245,0.45)]',
    'outline-none focus:border-[rgba(116,166,255,0.58)] focus:ring-2 focus:ring-[rgba(116,166,255,0.18)]',
    'transition-all disabled:opacity-40',
  ].join(' '),

  inputSm: [
    'w-full rounded-lg border border-[rgba(168,185,212,0.2)] bg-[rgba(8,18,34,0.84)]',
    'px-2.5 py-1.5 text-xs font-medium text-[rgba(245,247,251,0.96)] placeholder:text-[rgba(230,236,245,0.45)]',
    'outline-none focus:border-[rgba(116,166,255,0.58)] transition-all',
  ].join(' '),

  btnPrimary: [
    'flex items-center justify-center gap-1.5',
    'bg-[linear-gradient(180deg,#5b93f7_0%,#447de5_100%)] hover:brightness-105 active:brightness-95',
    'text-white px-4 py-2.5 rounded-xl text-sm font-semibold',
    'transition-all disabled:opacity-40 disabled:cursor-not-allowed',
    'shadow-[0_10px_24px_rgba(68,125,229,0.25)]',
  ].join(' '),

  btnSecondary: [
    'flex items-center justify-center gap-1.5',
    'bg-[rgba(18,32,54,0.72)] hover:bg-[rgba(27,44,70,0.82)]',
    'text-[rgba(245,247,251,0.92)] px-4 py-2.5 rounded-xl text-sm font-semibold',
    'transition-all border border-[rgba(168,185,212,0.18)] backdrop-blur-md',
  ].join(' '),

  btnDanger: [
    'flex items-center justify-center gap-1.5',
    'bg-[#d9534f] hover:bg-[#e1635e]',
    'text-white px-4 py-2.5 rounded-xl text-sm font-semibold',
    'transition-all',
  ].join(' '),

  btnGhost: [
    'flex items-center justify-center gap-1.5',
    'text-[rgba(116,166,255,0.94)] hover:bg-[rgba(76,139,245,0.1)]',
    'px-3 py-2 rounded-xl text-sm font-semibold transition-all',
  ].join(' '),

  th: 'text-left px-4 py-3 text-[11px] font-semibold text-[rgba(230,236,245,0.56)] uppercase tracking-[0.16em] whitespace-nowrap',
  td: 'px-4 py-3.5 text-sm text-[rgba(245,247,251,0.9)]',
  card: 'rounded-2xl border border-[rgba(162,180,206,0.16)] bg-[rgba(10,23,41,0.72)] backdrop-blur-xl shadow-[0_18px_50px_rgba(2,8,23,0.34)]',
}

// ── Modal (iOS Bottom Sheet) ───────────────────────────────────────────────
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-[6px]"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`
        bg-[rgba(10,23,41,0.88)] w-full ${maxW[size]}
        rounded-t-[20px] sm:rounded-[20px]
        max-h-[92dvh] flex flex-col
        shadow-[0_-2px_40px_rgba(2,8,23,0.55)] sm:shadow-[0_16px_48px_rgba(2,8,23,0.5)]
        ios-sheet-enter
        border border-[rgba(162,180,206,0.16)]
      `}>
        {/* Drag handle (mobil) */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-9 h-1 rounded-full bg-[rgba(255,255,255,0.2)]" />
        </div>

        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(162,180,206,0.14)] shrink-0">
          <h2 className="text-base font-semibold text-[rgba(245,247,251,0.96)] tracking-tight">{title}</h2>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-[rgba(18,32,54,0.75)] flex items-center justify-center text-[rgba(230,236,245,0.65)] hover:text-white transition-colors">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* İçerik */}
        <div className={`flex-1 overflow-y-auto p-5 ${!footer ? 'pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5' : ''}`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-[rgba(162,180,206,0.14)] shrink-0">
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
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-[rgba(230,236,245,0.62)] uppercase tracking-[0.14em]">
        {label}{required && <span className="text-[#FF453A] ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[rgba(230,236,245,0.42)]">{hint}</p>}
      {error && (
        <p className="text-xs text-[#FF453A] flex items-center gap-1">
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
      <Loader2 size={24} className="animate-spin text-[#0A84FF]" />
      <span className="text-sm text-[rgba(230,236,245,0.5)]">{text}</span>
    </div>
  )
}

// ── ErrorMsg ──────────────────────────────────────────────────────────────
export function ErrorMsg({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.18)] p-4 text-sm text-[#fca5a5]">
      <AlertCircle size={16} className="shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-semibold underline text-[#FF453A] hover:text-[#FF6961]">
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
      <p className="text-sm text-[rgba(245,247,251,0.82)]">{message}</p>
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
    beyanname: 'bg-[rgba(191,90,242,0.2)] text-[#BF5AF2]',
    odeme:     'bg-[rgba(255,159,10,0.2)] text-[#FF9F0A]',
    bordro:    'bg-[rgba(10,132,255,0.2)] text-[#0A84FF]',
    mutabakat: 'bg-[rgba(90,200,245,0.2)] text-[#5AC8F5]',
    edefter:   'bg-[rgba(94,92,230,0.2)] text-[#5E5CE6]',
    diger:     'bg-[rgba(120,120,128,0.2)] text-[rgba(235,235,245,0.5)]',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${colors[tip]}`}>
      {TIP_LABEL[tip]}
    </span>
  )
}

// ── Kalan Gün ─────────────────────────────────────────────────────────────
export function KalanGunBadge({ gun }: { gun: number }) {
  if (gun < 0)   return <span className="text-xs font-semibold text-[#FF453A]">{Math.abs(gun)} gün gecikti</span>
  if (gun === 0) return <span className="text-xs font-semibold text-[#FF453A]">Bugün!</span>
  if (gun <= 3)  return <span className="text-xs font-semibold text-[#FF9F0A]">{gun} gün kaldı</span>
  return <span className="text-xs text-[rgba(235,235,245,0.3)]">{gun} gün kaldı</span>
}

// ── Empty State ───────────────────────────────────────────────────────────
export function Empty({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[rgba(18,32,54,0.85)] border border-[rgba(162,180,206,0.14)]">
        <Icon size={28} className="text-[rgba(230,236,245,0.36)]" />
      </div>
      <p className="text-sm font-semibold text-[rgba(245,247,251,0.86)]">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-[rgba(230,236,245,0.44)]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
