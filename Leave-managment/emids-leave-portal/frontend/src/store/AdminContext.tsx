import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { TOAST_KIND } from '../constants'
import {
  adminCreateEmployee,
  adminInitPasswordReset,
  adminSetEmployeeActive,
  adminUpdateEmployee,
  fetchAdminEmployees,
} from '../services/admin'
import type {
  EmployeeAdminRow,
  EmployeeCreateInput,
  EmployeeCreateResult,
  EmployeePage,
  EmployeeUpdateInput,
  PasswordResetInit,
} from '../types/models'

export interface AdminContextValue {
  employees: EmployeeAdminRow[]
  total: number
  loading: boolean
  search: string
  setSearch: (value: string) => void
  reload: (search?: string) => void
  createEmployee: (input: EmployeeCreateInput) => Promise<EmployeeCreateResult | null>
  updateEmployee: (id: string, input: EmployeeUpdateInput) => Promise<EmployeeAdminRow | null>
  setEmployeeActive: (id: string, active: boolean) => Promise<boolean>
  initPasswordReset: (userId: string) => Promise<PasswordResetInit | null>
}

export const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const { setToast } = useAuth()
  const [page, setPage] = useState<EmployeePage>({ items: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)

  const reload = useCallback((nextSearch?: string) => {
    if (nextSearch !== undefined) setSearch(nextSearch)
    setReloadNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchAdminEmployees(search)
      .then(({ page: fresh, error }) => {
        if (!mounted) return
        setLoading(false)
        if (error) {
          setToast(error.userMessage, TOAST_KIND.Error)
          return
        }
        setPage(fresh)
      })
      .catch(() => {
        if (!mounted) return
        setLoading(false)
        setToast('Something went wrong. Please try again.', TOAST_KIND.Error)
      })
    return () => {
      mounted = false
    }
  }, [search, reloadNonce, setToast])

  const createEmployee = useCallback(
    async (input: EmployeeCreateInput) => {
      const { result, error } = await adminCreateEmployee(input)
      if (error || !result) {
        if (error) setToast(error.userMessage, TOAST_KIND.Error)
        return null
      }
      setToast('Employee added', TOAST_KIND.Ok)
      reload(search)
      return result
    },
    [reload, search, setToast]
  )

  const updateEmployee = useCallback(
    async (id: string, input: EmployeeUpdateInput) => {
      const { employee, error } = await adminUpdateEmployee(id, input)
      if (error || !employee) {
        if (error) setToast(error.userMessage, TOAST_KIND.Error)
        return null
      }
      setToast('Employee updated', TOAST_KIND.Ok)
      reload(search)
      return employee
    },
    [reload, search, setToast]
  )

  const setEmployeeActive = useCallback(
    async (id: string, active: boolean) => {
      const { error } = await adminSetEmployeeActive(id, active)
      if (error) {
        if (error) setToast(error.userMessage, TOAST_KIND.Error)
        return false
      }
      setToast(active ? 'Employee activated' : 'Employee deactivated', active ? TOAST_KIND.Ok : TOAST_KIND.Error)
      reload(search)
      return true
    },
    [reload, search, setToast]
  )

  const initPasswordReset = useCallback(
    async (userId: string) => {
      const { init, error } = await adminInitPasswordReset(userId)
      if (error || !init) {
        if (error) setToast(error.userMessage, TOAST_KIND.Error)
        return null
      }
      return init
    },
    [setToast]
  )

  const value = useMemo<AdminContextValue>(
    () => ({
      employees: page.items,
      total: page.total,
      loading,
      search,
      setSearch,
      reload,
      createEmployee,
      updateEmployee,
      setEmployeeActive,
      initPasswordReset,
    }),
    [page, loading, search, reload, createEmployee, updateEmployee, setEmployeeActive, initPasswordReset]
  )
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export const useAdmin = (): AdminContextValue => useContext(AdminContext) as AdminContextValue
