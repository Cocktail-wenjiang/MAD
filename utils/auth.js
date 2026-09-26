import { loadSession } from './storage'
export function currentSession() { return loadSession() }
export function requireLogin() { if (loadSession()) return true; uni.redirectTo({ url: '/pages/login/login' }); return false }
