'use client'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ title, onClose, children, footer, size = 'md' }: ModalProps) {
  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white w-full ${widths[size]} rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto fade-in`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-800 text-sm">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <X size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex gap-3 px-5 pb-5 border-t border-slate-100 pt-4">{footer}</div>}
      </div>
    </div>
  )
}

export function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 block mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

export const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all bg-white text-slate-800 placeholder:text-slate-400"
export const btnPrimary = "flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
export const btnSecondary = "flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
