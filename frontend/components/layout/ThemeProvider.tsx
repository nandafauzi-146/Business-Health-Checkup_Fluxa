'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  preference: ThemePreference
  isDark: boolean
  setPreference: (preference: ThemePreference) => void
}

const STORAGE_KEY = 'fluxa-theme'
const ACTIVE_USER_STORAGE_KEY = 'fluxa-theme-active-user'
const THEME_CHANGE_EVENT = 'fluxa-theme-change'
const ThemeContext = createContext<ThemeContextValue | null>(null)
const memoryPreferences = new Map<string, ThemePreference>()
let storageErrorReported = false
let activeUserId: string | null = null
const authListeners = new Set<() => void>()
let stopAuthListener: (() => void) | undefined

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function getPreferenceSnapshot(): ThemePreference {
  const userId = activeUserId ?? getLastActiveUserId()
  const key = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY
  try {
    const stored = window.localStorage.getItem(key)
    if (isThemePreference(stored)) return stored
    if (userId) {
      const legacy = window.localStorage.getItem(STORAGE_KEY)
      if (isThemePreference(legacy)) return legacy
    }
  } catch (error) {
    if (!storageErrorReported) {
      console.error('Unable to read theme preference.', error)
      storageErrorReported = true
    }
  }
  return memoryPreferences.get(key) ?? 'system'
}

function getLastActiveUserId() {
  try {
    return window.localStorage.getItem(ACTIVE_USER_STORAGE_KEY)
  } catch (error) {
    if (!storageErrorReported) {
      console.error('Unable to read theme account preference.', error)
      storageErrorReported = true
    }
    return null
  }
}

function subscribeToAuthUser(onChange: () => void) {
  authListeners.add(onChange)
  if (!stopAuthListener) {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      activeUserId = session?.user.id ?? null
      if (activeUserId) {
        try {
          window.localStorage.setItem(ACTIVE_USER_STORAGE_KEY, activeUserId)
        } catch (error) {
          console.error('Unable to save active theme account.', error)
        }
      }
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
    })
    stopAuthListener = () => subscription.unsubscribe()
  }
  return () => {
    authListeners.delete(onChange)
    if (authListeners.size === 0) {
      stopAuthListener?.()
      stopAuthListener = undefined
    }
  }
}

function subscribeToPreference(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  const unsubscribeAuth = subscribeToAuthUser(onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
    unsubscribeAuth()
  }
}

function subscribeToSystemTheme(onChange: () => void) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

function getSystemThemeSnapshot() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribeToPreference,
    getPreferenceSnapshot,
    (): ThemePreference => 'system'
  )
  const systemIsDark = useSyncExternalStore(subscribeToSystemTheme, getSystemThemeSnapshot, () => false)
  const isDark = preference === 'dark' || (preference === 'system' && systemIsDark)

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    const userId = activeUserId ?? getLastActiveUserId()
    const key = userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY
    memoryPreferences.set(key, nextPreference)
    try {
      window.localStorage.setItem(key, nextPreference)
    } catch (error) {
      console.error('Unable to save theme preference.', error)
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.themePreference = preference
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  }, [preference, isDark])

  const value = useMemo(
    () => ({ preference, isDark, setPreference }),
    [preference, isDark, setPreference]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
