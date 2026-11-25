import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import type { WolfApi } from '../../shared/ipc'

declare global {
  interface Window { wolf: WolfApi }
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
