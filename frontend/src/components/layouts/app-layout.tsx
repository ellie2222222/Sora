'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, LogOut, Menu, Plus } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { AppSidebar } from '@/components/layouts/app-sidebar'
import { CreateWorkspaceDialog } from '@/components/workspace/create-workspace-dialog'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/ui/state'
import { ThemeSwitcher } from '@/components/ui/theme-switcher'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { useToast } from '@/components/providers/toast-provider'
import { useTranslate } from '@/hooks/useTranslate'

export interface Workspace {
  id: number
  name: string
  description?: string
  currency: string
  owner_id: number
  created_at: string
  user_role?: string
}

interface WorkspaceSummary {
  id: number
  name: string
  currency: string
}

const WorkspaceContext = createContext<Workspace | null>(null)

/**
 * Current workspace, loaded once by AppLayout.
 * Children only render after the fetch succeeds, so this is never null inside them.
 */
export function useCurrentWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) {
    throw new Error('useCurrentWorkspace must be used within AppLayout')
  }
  return workspace
}

interface AppLayoutProps {
  workspaceId: number
  /** Nav key of the current page — drives the sidebar active state. */
  activeKey: string
  /** Section name shown as the last breadcrumb segment. */
  breadcrumb: string
  children: React.ReactNode
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  workspaceId,
  activeKey,
  breadcrumb,
  children,
}) => {
  const router = useRouter()
  const { t } = useTranslate()
  const { toast } = useToast()

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [loading, setLoading] = useState(true)
  // Translation key rather than translated text, so the fetch effect never
  // depends on `t` and cannot re-run when the locale changes.
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  // The last workspace that loaded successfully. A failed switch falls back to it
  // instead of throwing the whole screen away — see the failure handling below.
  const loadedRef = useRef<Workspace | null>(null)

  useEffect(() => {
    if (!apiClient.isAuthenticated()) {
      router.push('/auth/login')
      return
    }

    let cancelled = false

    // A failure while a workspace is already open is a failed *switch*: the member
    // keeps working where they were and gets a toast, rather than losing the screen
    // to a full-page error. Only a cold load has nothing to fall back to.
    const reportFailure = (key: string) => {
      const fallback = loadedRef.current
      if (fallback && fallback.id !== workspaceId) {
        toast(t(key), 'error')
        setWorkspace(fallback)
        router.replace(`/app/workspaces/${fallback.id}/dashboard`)
        return
      }
      setErrorKey(key)
    }

    const load = async () => {
      setLoading(true)
      setErrorKey(null)

      try {
        const response = await apiClient.getWorkspace(workspaceId)
        if (cancelled) return

        if (response.success && response.data) {
          setWorkspace(response.data)
          loadedRef.current = response.data
        } else {
          reportFailure('common.error')
          return
        }
      } catch (err: any) {
        if (cancelled) return
        const status = err.response?.status
        if (status === 401) {
          router.push('/auth/login')
          return
        }
        reportFailure(
          status === 404 || status === 403 ? 'workspace.switchDenied' : 'workspace.switchFailed'
        )
        return
      } finally {
        if (!cancelled) setLoading(false)
      }

      // The switcher is a convenience (SRS §6.4); a failure here must not block the page.
      try {
        const list = await apiClient.listWorkspaces()
        if (!cancelled && list.success && list.data?.workspaces) {
          setWorkspaces(list.data.workspaces)
        }
      } catch {
        if (!cancelled) setWorkspaces([])
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, router, toast, t])

  const handleLogout = useCallback(async () => {
    const refreshToken = apiClient.getRefreshToken()
    if (refreshToken) {
      try {
        await apiClient.logout(refreshToken)
      } catch (err) {
        console.error('Logout error:', err)
      }
    }
    router.push('/auth/login')
  }, [router])

  // Only a cold load takes over the screen. Once a workspace is on screen a switch
  // keeps the shell mounted — the page below swaps in its own skeletons — so the
  // app never flashes back to a blank spinner mid-navigation.
  if (loading && !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
        <LoadingState label={t('common.loading')} />
      </div>
    )
  }

  if (errorKey || !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-md space-y-4">
          <ErrorState message={t(errorKey || 'common.error')} />
          <Button
            id="btn-back-to-dashboard"
            variant="secondary"
            onClick={() => router.push('/app/dashboard')}
          >
            {t('nav.dashboard')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <WorkspaceContext.Provider value={workspace}>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
        <AppSidebar
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          userRole={workspace.user_role}
          activeKey={activeKey}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((prev) => !prev)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className={`transition-[padding] duration-200 ${collapsed ? 'md:pl-[72px]' : 'md:pl-64'}`}>
          <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur dark:border-gray-800 dark:bg-slate-900/95">
            <button
              id="btn-open-sidebar"
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t('nav.openMenu')}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumbs: Home > Workspace > Section (SRS §6.4) */}
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-2 truncate text-sm">
                <li className="hidden sm:block">
                  <Link
                    href="/app/dashboard"
                    className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  >
                    {t('nav.home')}
                  </Link>
                </li>
                <li className="hidden text-gray-300 sm:block dark:text-gray-600">/</li>
                <li className="hidden max-w-[12rem] truncate sm:block">
                  <Link
                    href={`/app/workspaces/${workspace.id}/dashboard`}
                    className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  >
                    {workspace.name}
                  </Link>
                </li>
                <li className="hidden text-gray-300 sm:block dark:text-gray-600">/</li>
                <li
                  aria-current="page"
                  className="truncate font-medium text-gray-900 dark:text-white"
                >
                  {breadcrumb}
                </li>
              </ol>
            </nav>

            {/* Workspace switcher (SRS §6.4) — switching and creating happen here */}
            <div className="relative">
                <button
                  id="btn-workspace-switcher"
                  type="button"
                  onClick={() => setSwitcherOpen((prev) => !prev)}
                  aria-label={t('workspace.switchWorkspace')}
                  aria-expanded={switcherOpen}
                  className="flex min-h-10 max-w-[10rem] items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <span className="truncate">{workspace.name}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
                </button>

                {switcherOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setSwitcherOpen(false)}
                      aria-hidden="true"
                    />
                    <ul
                      id="list-workspace-switcher"
                      className="absolute right-0 z-20 mt-2 max-h-72 w-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-slate-800"
                    >
                      {workspaces.map((item) => (
                        <li key={item.id}>
                          <Link
                            id={`btn-switch-workspace-${item.id}`}
                            href={`/app/workspaces/${item.id}/dashboard`}
                            onClick={() => setSwitcherOpen(false)}
                            className="flex min-h-11 items-center justify-between gap-2 px-3 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            <span className="truncate">{item.name}</span>
                            {item.id === workspace.id && (
                              <Check className="h-4 w-4 shrink-0 text-green-500" />
                            )}
                          </Link>
                        </li>
                      ))}
                      <li
                        className="my-1 border-t border-gray-200 dark:border-gray-700"
                        aria-hidden="true"
                      />
                      <li>
                        <button
                          id="btn-add-workspace"
                          type="button"
                          onClick={() => {
                            setSwitcherOpen(false)
                            setCreateOpen(true)
                          }}
                          className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          <Plus className="h-4 w-4 shrink-0" />
                          <span className="truncate">{t('workspace.createWorkspace')}</span>
                        </button>
                      </li>
                    </ul>
                  </>
                )}
            </div>

            <div className="flex items-center gap-1">
              <ThemeSwitcher />
              <LanguageSwitcher />
              <button
                id="btn-logout"
                type="button"
                onClick={handleLogout}
                aria-label={t('auth.logout')}
                title={t('auth.logout')}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </header>

          <main aria-busy={loading} className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
      </div>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(newWorkspaceId) => {
          setCreateOpen(false)
          router.push(`/app/workspaces/${newWorkspaceId}/dashboard`)
        }}
      />
    </WorkspaceContext.Provider>
  )
}
