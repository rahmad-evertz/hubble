import { assertValidLogin } from '../lib/validate'
import { graphql, type Credentials } from './client'

export type Viewer = { login: string; name: string | null; avatarUrl: string }

const VIEWER_QUERY = `query { viewer { login name avatarUrl } }`

/** Proves a token works and tells us who it belongs to, before anything is saved. */
export async function fetchViewer(creds: Credentials): Promise<Viewer> {
  const data = await graphql<{ viewer: Viewer }>(VIEWER_QUERY, {}, creds)
  return data.viewer
}

export type OrgSummary = { login: string; name: string | null; avatarUrl: string }

const ORG_QUERY = `
query ($login: String!) {
  organization(login: $login) { login name avatarUrl }
}`

/**
 * Confirms an org exists and is visible to this token. A wrong org name and an
 * org the token has not been SSO-authorized for both surface here, at setup,
 * rather than as an inexplicably empty dashboard later.
 */
export async function fetchOrg(login: string, creds: Credentials): Promise<OrgSummary> {
  assertValidLogin(login, 'Organisation')
  const data = await graphql<{ organization: OrgSummary | null }>(ORG_QUERY, { login }, creds)
  if (!data.organization) {
    throw new Error(
      `No organisation named "${login}" is visible to this token. Check the spelling, and if it is a private org make sure the token is SSO-authorized for it.`,
    )
  }
  return data.organization
}
