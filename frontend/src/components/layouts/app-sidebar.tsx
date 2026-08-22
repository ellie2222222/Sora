'use client'

import React from 'react'
import Link from 'next/link'
import {
  ArrowLeftRight,
  ChevronLeft,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Tags,
  Target,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useTranslate } from '@/hooks/useTranslate'

/** Workspace roles that may see workspace-administration items (AC-01, FE-03). */
const ELEVATED_ROLES: string[] = ['OWNER']

export interface NavItem {
  key: string
  labelKey: string
  icon: React.ReactNode
  /** Path relative to the workspace root, e.g. 'transactions'. */
  path: string
  /** Only rendered for OWNER when true. */
  elevatedOnly?: boolean
  /** Rendered as a disabled entry — the route/API is not built yet. */
  pending?: boolean
}

interface NavGroup {
  labelKey: string
  items: NavItem[]
}

const ICON_CLASS = 'h-[18px] w-[18px] shrink-0'

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.overview',
    items: [
      {
        key: 'dashboard',
        labelKey: 'nav.dashboard',
        icon: <LayoutDashboard className={ICON_CLASS} />,
        path: 'dashboard',
      },
    ],
  },
  {
    labelKey: 'nav.money',
    items: [
      {
        key: 'accounts',
        labelKey: 'nav.accounts',
        icon: <Wallet className={ICON_CLASS} />,
        path: 'accounts',
      },
      {
        key: 'transactions',
        labelKey: 'nav.transactions',
        icon: <ArrowLeftRight className={ICON_CLASS} />,
        path: 'transactions',
      },
      {
        key: 'budgets',
        labelKey: 'nav.budgets',
        icon: <PiggyBank className={ICON_CLASS} />,
        path: 'budgets',
        pending: true,
      },
      {
        key: 'goals',
        labelKey: 'nav.goals',
        icon: <Target className={ICON_CLASS} />,
        path: 'goals',
        pending: true,
      },
      {
        key: 'bills',
        labelKey: 'nav.bills',
        icon: <Receipt className={ICON_CLASS} />,
        path: 'bills',
        pending: true,
      },
      {
        key: 'categories',
        labelKey: 'nav.categories',
        icon: <Tags className={ICON_CLASS} />,
        path: 'categories',
      },
    ],
  },
  {
    labelKey: 'nav.workspace',
    items: [
      {
        key: 'members',
        labelKey: 'nav.members',
        icon: <Users className={ICON_CLASS} />,
        path: 'members',
        pending: true,
      },
      {
        key: 'invite',
        labelKey: 'nav.inviteMember',
        icon: <UserPlus className={ICON_CLASS} />,
        path: 'members/invite',
        elevatedOnly: true,
      },
      {
        key: 'settings',
        labelKey: 'nav.settings',
        icon: <Settings className={ICON_CLASS} />,
        path: 'settings',
        elevatedOnly: true,
      },
    ],
  },
]

interface AppSidebarProps {
  workspaceId: number
  workspaceName: string
  /** Workspace role of the signed-in member; undefined while loading. */
  userRole?: string
  /** Nav key of the current page, used for the active highlight. */
  activeKey: string
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Mobile drawer state — ignored on md+ where the sidebar is always docked. */
  mobileOpen: boolean
  onCloseMobile: () => void
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  workspaceId,
  workspaceName,
  userRole,
  activeKey,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}) => {
  const { t } = useTranslate()
  const isElevated = !!userRole && ELEVATED_ROLES.includes(userRole)

  const renderItem = (item: NavItem) => {
    const label = t(item.labelKey)
    const isActive = item.key === activeKey
    const href = `/app/workspaces/${workspaceId}/${item.path}`

    // min-h-12 keeps touch targets at 48px (SDS §3.1 mobile responsiveness).
    const shared = `flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
      collapsed ? 'md:justify-center md:px-0' : ''
    }`

    if (item.pending) {
      return (
        <li key={item.key}>
          <span
            id={`nav-${item.key}`}
            aria-disabled="true"
            title={`${label} — ${t('nav.comingSoon')}`}
            className={`${shared} cursor-not-allowed text-gray-400 dark:text-gray-600`}
          >
            {item.icon}
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{label}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {t('nav.comingSoon')}
                </span>
              </>
            )}
          </span>
        </li>
      )
    }

    return (
      <li key={item.key}>
        <Link
          id={`nav-${item.key}`}
          href={href}
          onClick={onCloseMobile}
          aria-current={isActive ? 'page' : undefined}
          title={collapsed ? label : undefined}
          className={`${shared} ${
            isActive
              ? 'bg-slate-800 font-medium text-white dark:bg-white dark:text-slate-900'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          {item.icon}
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
        </Link>
      </li>
    )
  }

  const nav = (
    <nav aria-label={t('nav.workspace')} className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.elevatedOnly || isElevated)
        if (items.length === 0) return null

        return (
          <div key={group.labelKey}>
            {!collapsed && (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t(group.labelKey)}
              </p>
            )}
            <ul className="space-y-1">{items.map(renderItem)}</ul>
          </div>
        )
      })}
    </nav>
  )

  const header = (
    <div className="flex min-h-16 items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-800">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white dark:bg-white dark:text-slate-900">
        <Wallet className="h-[18px] w-[18px]" />
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {workspaceName}
          </p>
          {userRole && (
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{userRole}</p>
          )}
        </div>
      )}
      <button
        id="btn-close-sidebar"
        type="button"
        onClick={onCloseMobile}
        aria-label={t('nav.closeMenu')}
        className="ml-auto rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )

  const footer = (
    <div className="hidden border-t border-gray-200 p-3 md:block dark:border-gray-800">
      <button
        id="btn-toggle-sidebar"
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
        className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 ${
          collapsed ? 'justify-center px-0' : ''
        }`}
      >
        <ChevronLeft
          className={`h-[18px] w-[18px] shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`}
        />
        {!collapsed && <span>{t('nav.collapseSidebar')}</span>}
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-gray-200 bg-white transition-[transform,width] duration-200 md:translate-x-0 dark:border-gray-800 dark:bg-slate-900 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-64 md:w-[72px]' : 'w-64'}`}
      >
        {header}
        {nav}
        {footer}
      </aside>
    </>
  )
}
