import type { SanctuaryAPI } from '../shared/types'
declare global {
  interface Window {
    sanctuaryAPI: SanctuaryAPI
  }
}
export {}
