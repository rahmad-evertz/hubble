import { useState } from 'react'
import { fetchOrg, fetchViewer, type Viewer } from '../api/identity'
import { isValidLogin, looksLikeToken } from '../lib/validate'
import type { AppConfig } from '../types'

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo,read:org&description=hubble'

type Props = {
  initial: AppConfig
  onComplete: (config: AppConfig) => void
}

/**
 * Three steps rather than one form, because each answer depends on the previous
 * one being verified: the token has to work before it can tell us who you are,
 * and the org has to be checked with that same token or an unauthorized private
 * org would look identical to a typo.
 */
export default function SetupScreen({ initial, onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [token, setToken] = useState(initial.githubToken)
  const [username, setUsername] = useState(initial.username)
  const [org, setOrg] = useState(initial.org)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const creds = { token: token.trim(), apiBaseUrl: initial.apiBaseUrl }

  async function verifyToken() {
    setBusy(true)
    setError(null)
    try {
      const me = await fetchViewer(creds)
      setViewer(me)
      // Default to the token's own account: it is right nearly always, and it is
      // the only case where the notification inbox can work.
      if (!username) setUsername(me.login)
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function confirmUsername() {
    if (!isValidLogin(username.trim())) {
      setError('That is not a valid GitHub username.')
      return
    }
    setError(null)
    setStep(3)
  }

  async function verifyOrgAndFinish() {
    const wanted = org.trim()
    if (!wanted) {
      finish('')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const found = await fetchOrg(wanted, creds)
      finish(found.login)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function finish(resolvedOrg: string) {
    onComplete({
      ...initial,
      githubToken: token.trim(),
      username: username.trim(),
      org: resolvedOrg,
    })
  }

  const differentUser = viewer !== null && username.trim() !== viewer.login

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>Hubble</h1>
        <p className="setup-tagline">
          Everything in your name across an organisation, resolved into one view.
        </p>

        <div className="steps" aria-hidden="true">
          <span className={`step-pip ${step > 1 ? 'done' : 'active'}`} />
          <span className={`step-pip ${step > 2 ? 'done' : step === 2 ? 'active' : ''}`} />
          <span className={`step-pip ${step === 3 ? 'active' : ''}`} />
        </div>

        {step === 1 && (
          <>
            <p className="scopes">
              Hubble runs entirely in your browser and talks to GitHub directly — there is no server
              and nothing is sent anywhere else. Your token is stored only in this browser&apos;s
              local storage. It needs <code>repo</code> to read pull requests on private
              repositories and <code>read:org</code> to resolve organisation membership.
            </p>
            <div className="field">
              <label htmlFor="token">Personal access token</label>
              <input
                id="token"
                type="password"
                value={token}
                autoComplete="off"
                spellCheck={false}
                placeholder="ghp_…"
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && looksLikeToken(token)) void verifyToken()
                }}
              />
              <div className="hint">
                <a href={TOKEN_URL} target="_blank" rel="noreferrer">
                  Create one with the right scopes pre-filled →
                </a>
              </div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="setup-actions">
              <button
                className="btn btn-primary"
                disabled={busy || !looksLikeToken(token)}
                onClick={() => void verifyToken()}
              >
                {busy ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="field">
              <label htmlFor="username">Whose activity should this dashboard show?</label>
              <input
                id="username"
                type="text"
                value={username}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmUsername()
                }}
              />
              <div className="hint">
                {viewer && `Your token belongs to ${viewer.login}.`} Pull requests, reviews and
                stats are all read for this user.
              </div>
            </div>
            {differentUser && (
              <div className="alert alert-info">
                Pointing Hubble at someone else works, with two limits: the notification inbox is
                always your own (GitHub exposes no one else&apos;s), and you will only see private
                repositories your token can reach.
              </div>
            )}
            {error && <div className="alert alert-error">{error}</div>}
            <div className="setup-actions">
              <button className="btn btn-primary" onClick={confirmUsername}>
                Continue
              </button>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="field">
              <label htmlFor="org">Organisation</label>
              <input
                id="org"
                type="text"
                value={org}
                autoComplete="off"
                spellCheck={false}
                placeholder="my-org"
                onChange={(e) => setOrg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void verifyOrgAndFinish()
                }}
              />
              <div className="hint">
                Every search is scoped to this organisation, across all of its repositories — no
                repository list to curate. Leave it blank to search everything your token can see.
              </div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="setup-actions">
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void verifyOrgAndFinish()}
              >
                {busy ? 'Checking…' : 'Open dashboard'}
              </button>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
