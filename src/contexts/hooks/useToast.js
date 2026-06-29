import { useContext } from 'react'
import { ToastCtx } from '../ToastContextValue'

export function useToast() {
  return useContext(ToastCtx)
}
