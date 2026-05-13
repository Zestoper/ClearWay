import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import './Toast.css'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem { id: number; message: string; type: ToastType }
interface ToastCtx  { toast: (message: string, type?: ToastType) => void }

const Ctx = createContext<ToastCtx>({ toast: () => {} })
export const useToast = () => useContext(Ctx)

let _id = 0

const ICONS: Record<ToastType, string> = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = _id++
    setItems(prev => [...prev, { id, message, type }])
    setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 3800)
  }, [])

  const remove = (id: number) => setItems(p => p.filter(x => x.id !== id))

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {items.length > 0 && (
        <div className="toast-stack">
          {items.map(item => (
            <div key={item.id} className={`toast-item toast--${item.type}`}>
              <span className="toast-icon">{ICONS[item.type]}</span>
              <span className="toast-msg">{item.message}</span>
              <button className="toast-close" onClick={() => remove(item.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  )
}
