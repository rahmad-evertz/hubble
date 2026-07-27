import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthError, type Credentials } from './api/client'
import { fetchViewer } from './api/identity'
import { fetchPanels, PANEL_KEYS, patchPanelsPr, removePanelsPr } from './api/prs'
import { fetchStats } from './api/stats'
import Header from './components/Header'
import NotificationInbox from './components/NotificationInbox'
import PrTable from './components/PrTable'
import PrDetailModal from './components/PrDetailModal'
import RateLimitFooter from './components/RateLimitFooter'
import Settings from './components/Settings'
import SetupScreen from './components/SetupScreen'
import StatsPanel from './components/StatsPanel'
import { useAsync } from './hooks/useAsync'
import { useAutoRefresh } from './hooks/useAutoRefresh'
import { useNotifications } from './hooks/useNotifications'
import { useTheme } from './hooks/useTheme'
import { BLANK_CONFIG, clearConfig, isConfigured, loadConfig, saveConfig } from './lib/config'
import * as storage from './lib/storage'
import type { AppConfig, PanelKey, PrMutationEffect } from './types'

type TabKey = PanelKey | 'inbox' | 'stats'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mine', label: 'My PRs' },
  { key: 'requested', label: 'To review' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'mentioned', label: 'Mentioned' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'stats', label: 'Stats' },
]

const EMPTY_COPY: Record<PanelKey, { title: string; body: string }> = {
  mine: { title: 'No open pull requests', body: 'Nothing you have authored is currently open.' },
  requested: {
    title: 'No reviews waiting on you',
    body: 'Nobody has requested your review in this scope.',
  },
  assigned: { title: 'Nothing assigned', body: 'No open pull requests are assigned to you.' },
  mentioned: { title: 'No mentions', body: 'You are not mentioned in any open pull request.' },
}

function initialTab(): TabKey {
  const wanted = new URLSearchParams(window.location.search).get('panel')
  return TABS.some((t) => t.key === wanted) ? (wanted as TabKey) : 'mine'
}

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [showSettings, setShowSettings] = useState(false)
  const [refreshMinutes, setRefreshMinutes] = useState(() => storage.read('refreshMinutes', 10))
  const [theme, setTheme] = useTheme()
  const [viewerLogin, setViewerLogin] = useState<string | null>(null)
  /** Stats cost a request, so they are not fetched until the tab is first opened. */
  const [statsRequested, setStatsRequested] = useState(() => initialTab() === 'stats')
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null)

  useEffect(() => {
    void loadConfig().then(setConfig)
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('panel', tab)
    window.history.replaceState(null, '', url)
  }, [tab])

  const ready = config !== null && isConfigured(config)
  const creds: Credentials = useMemo(
    () => ({ token: config?.githubToken ?? '', apiBaseUrl: config?.apiBaseUrl ?? '' }),
    [config?.githubToken, config?.apiBaseUrl],
  )
  const queryCtx = useMemo(
    () => ({ username: config?.username ?? '', org: config?.org ?? '' }),
    [config?.username, config?.org],
  )
  const scopeKey = `${creds.token}|${queryCtx.username}|${queryCtx.org}`

  // Resolve the token's own account, which decides whether the inbox is meaningful.
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetchViewer(creds)
      .then((v) => !cancelled && setViewerLogin(v.login))
      .catch(() => !cancelled && setViewerLogin(null))
    return () => {
      cancelled = true
    }
  }, [ready, creds])

  const panels = useAsync(() => fetchPanels(queryCtx, creds), scopeKey, ready)
  const stats = useAsync(() => fetchStats(queryCtx, creds), scopeKey, ready && statsRequested)
  const inboxAvailable = viewerLogin !== null && viewerLogin === queryCtx.username
  const notifications = useNotifications(creds, queryCtx.org, ready && inboxAvailable)

  const selectedPr = selectedPrId
    ? (panels.data?.all.find((p) => p.id === selectedPrId) ?? null)
    : null

  const handlePrMutated = useCallback(
    (prId: string, effect: PrMutationEffect) => {
      if (effect.type === 'closed') {
        panels.mutate((prev) => removePanelsPr(prev, prId))
      } else if (effect.type === 'review') {
        panels.mutate((prev) =>
          patchPanelsPr(prev, prId, { userLatestReview: effect.userLatestReview }),
        )
      } else {
        panels.mutate((prev) => patchPanelsPr(prev, prId, { isDraft: effect.isDraft }))
      }
      panels.refresh()
    },
    [panels],
  )

  const refreshAll = useCallback(() => {
    panels.refresh()
    notifications.refresh()
    if (statsRequested) stats.refresh()
  }, [panels, notifications, stats, statsRequested])

  // GitHub advertises a minimum notification poll interval; never beat it.
  const pollFloor = notifications.pollSeconds ?? 60
  const intervalSeconds = Math.max(refreshMinutes * 60, pollFloor)
  useAutoRefresh(refreshAll, intervalSeconds, refreshMinutes > 0)

  const signOut = useCallback(() => {
    clearConfig()
    setConfig({ ...BLANK_CONFIG })
    setViewerLogin(null)
    setShowSettings(false)
  }, [])

  // A revoked token should drop straight back to setup rather than loop on errors.
  const authFailed = panels.error instanceof AuthError || notifications.error instanceof AuthError

  if (config === null) {
    return <div className="skeleton">Loading…</div>
  }

  if (!isConfigured(config) || authFailed) {
    return (
      <SetupScreen
        initial={authFailed ? { ...config, githubToken: '' } : config}
        onComplete={(next) => {
          saveConfig(next)
          setConfig(next)
        }}
      />
    )
  }

  const loading = panels.loading || notifications.loading || stats.loading
  const error = panels.error ?? notifications.error ?? stats.error

  return (
    <div className="app">
      <Header
        username={config.username}
        org={config.org}
        updatedAt={panels.updatedAt}
        loading={loading}
        theme={theme}
        onThemeChange={setTheme}
        onRefresh={refreshAll}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="main">
        {error && (
          <div className="alert alert-error">
            {error.message}
            {' — showing the last data that loaded successfully.'}
          </div>
        )}

        <div className="tabs" role="tablist">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              className="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key)
                if (key === 'stats') setStatsRequested(true)
              }}
            >
              {label}
              <Count tabKey={key} panels={panels.data} unread={notifications.items.length} />
            </button>
          ))}
        </div>

        {PANEL_KEYS.includes(tab as PanelKey) &&
          (panels.data ? (
            <div className="card">
              <PrTable
                prs={panels.data.panels[tab as PanelKey].prs}
                config={config}
                emptyTitle={EMPTY_COPY[tab as PanelKey].title}
                emptyBody={EMPTY_COPY[tab as PanelKey].body}
                onOpen={(pr) => setSelectedPrId(pr.id)}
              />
            </div>
          ) : (
            <div className="skeleton">Loading pull requests…</div>
          ))}

        {tab === 'inbox' && (
          <NotificationInbox
            items={notifications.items}
            available={inboxAvailable}
            viewerLogin={viewerLogin ?? '—'}
            username={config.username}
            marking={notifications.marking}
            onMarkRead={(ids) => void notifications.markRead(ids)}
          />
        )}

        {tab === 'stats' &&
          (stats.data ? (
            <StatsPanel stats={stats.data} org={config.org} />
          ) : (
            <div className="skeleton">Loading contribution stats…</div>
          ))}
      </main>

      <RateLimitFooter notificationPollSeconds={notifications.pollSeconds} />

      {showSettings && (
        <Settings
          config={config}
          refreshMinutes={refreshMinutes}
          viewerLogin={viewerLogin}
          onSave={(next, minutes) => {
            saveConfig(next)
            setConfig(next)
            storage.write('refreshMinutes', minutes)
            setRefreshMinutes(minutes)
            setShowSettings(false)
          }}
          onSignOut={signOut}
          onClose={() => setShowSettings(false)}
        />
      )}

      {selectedPr && (
        <PrDetailModal
          key={selectedPr.id}
          pr={selectedPr}
          creds={creds}
          viewerLogin={viewerLogin}
          onClose={() => setSelectedPrId(null)}
          onMutated={handlePrMutated}
        />
      )}
    </div>
  )
}

function Count({
  tabKey,
  panels,
  unread,
}: {
  tabKey: TabKey
  panels: Awaited<ReturnType<typeof fetchPanels>> | null
  unread: number
}) {
  if (tabKey === 'stats') return null
  if (tabKey === 'inbox') return unread > 0 ? <span className="tab-count">{unread}</span> : null
  const total = panels?.panels[tabKey as PanelKey].total
  return total ? <span className="tab-count">{total}</span> : null
}
