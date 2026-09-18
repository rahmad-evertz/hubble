# Hubble

A personal GitHub dashboard for one user across one organisation: every open pull
request in your name, everywhere you are tagged, your notification inbox, and what
your contribution has actually looked like over time. Built to sit in a browser tab.

Nothing about any specific organisation, user, or issue tracker is compiled in. You
supply a token, a username, and an organisation on first load; the same deployed
build works for anyone.

- [How it works](#how-it-works)
- [Run it locally](#run-it-locally)
- [Deploy it](#deploy-it)
- [The four panels](#the-four-panels)
- [Things worth knowing](#things-worth-knowing)

## How it works

Vite + React + TypeScript, built to static files and hosted on GitHub Pages. There
is no backend, so there is nowhere to run a GitHub CLI or hold a shared token.
Instead each visitor brings their own personal access token, which is kept in their
own browser and used to call `api.github.com` directly.

```
first load ─► nothing stored ─► setup screen
                                    │  1. token      → verified with viewer { login }
                                    │  2. username   → prefilled from the token, editable
                                    │  3. org        → verified with organization(login:)
                                    ▼
                     localStorage: { token, username, org }
                                    │
        ┌───────────────────────────┼────────────────────────────┐
        ▼                           ▼                            ▼
  GraphQL: 4 panels          GraphQL: 29 counts          REST: /notifications
  in one request             in one request              Link-paginated
```

Two consequences worth stating plainly:

- **Your token never leaves your browser.** It is not sent to any server, because
  there is no server. Signing out deletes it.
- **The published build contains no data.** It ships a copy of
  `app-config.example.json`, in which `githubToken`, `username` and `org` are all
  empty, and the deploy workflow fails the build if any of the three is ever
  non-blank. Hosting the site publicly exposes source code, nothing else.

Everything is fetched through GraphQL where GitHub offers it, because aliased
sub-queries share a rate-limit cost. The stats panel issues **29 searches for a
single point** of a 5,000/hour budget. The REST search API would have capped the
whole dashboard at 30 requests per minute.

## Run it locally

Requires **Node 20 or newer**.

```bash
npm install
npm run dev          # → http://localhost:5173
```

The setup screen appears on first load. There is no config file to create. One is
optional, and only useful to skip the setup screen while iterating:

```bash
cp public/config/app-config.example.json public/config/app-config.json
# fill in githubToken / username / org; the file is gitignored
```

```bash
npm run ci:check     # prettier + eslint + tsc, the same gate CI runs
npm test             # unit tests for the query grammar and date bucketing
npm run build        # production build into dist/
```

### The token

Create a classic token with **`repo`** and **`read:org`**:

```
https://github.com/settings/tokens/new?scopes=repo,read:org&description=hubble
```

`repo` reads pull requests on private repositories and is also what permits reading
your notifications. `read:org` resolves organisation membership.

**If your organisation uses SAML single sign-on, the token must be SSO-authorized
for it**, otherwise every query succeeds and returns nothing. The setup screen
checks the organisation up front so this surfaces as an error rather than an
inexplicably empty dashboard.

## Deploy it

Push to `main`. The workflow lints, type-checks, tests, builds with `base` derived
from the repository name, and publishes to Pages. **No repository secret is
required.**

One-time setup: enable Pages for the repository with **Source: GitHub Actions**.

Private repositories can restrict who may view the published site, which needs a
paid plan for personal accounts. If that is unavailable, publishing publicly is
safe here: the build holds no token, no data and no identifiers, and CI enforces it.

## The four panels

| Panel         | What it answers                                | Query                            |
| ------------- | ---------------------------------------------- | -------------------------------- |
| **My PRs**    | What of mine is open, and what is blocking it? | `author:<you> OR assignee:<you>` |
| **To review** | What is waiting on me?                         | `review-requested:<you>`         |
| **Mentioned** | Where am I tagged?                             | `mentions:<you>`                 |
| **Inbox**     | What has GitHub told me, grouped by why?       | REST `/notifications`            |
| **Stats**     | What has my contribution looked like?          | 12 monthly search buckets        |

Authored and assigned share one tab, because in practice they answer the same
question. The badge on it is a single server-side count over both, so a pull
request that is yours _and_ assigned to you is counted once rather than twice.

Every query is scoped with `org:<name>` and nothing else, so **all repositories in
the organisation are covered with no list to curate**. Leave the organisation blank
to search everything your token can see.

A pull request that reaches you more than one way, authored by you _and_ mentioning
you, appears once, carrying both role badges.

## Two views of the same list

The pull-request panels render as a **deck** by default: cards on a perspective
plane, nearest first, receding into the distance in whatever order the sort
control is set to. Under **Activity** the nearest card is the most recently
touched; under **Age** it is the oldest, which is the useful direction for
finding neglected work. A card is pulled slightly forward, and its rim tinted,
when something about it asks for action: a failing check, a conflict, requested
changes, or a review request you have not answered. That pull is always smaller
than one slot, so the visual order can never disagree with the reading order,
which is what keeps tab traversal and screen-reader order honest.

The **table** is one click away and the choice is remembered. It is denser, and
it stays the better tool when you want eleven columns at once.

Motion answers to `prefers-reduced-motion`. With it set, the ambient drift and
the pointer parallax stop and the deck flattens to a plain card list, while the
depth hierarchy, the shadows and every instant state change stay exactly as they
are. Below 720px the deck flattens too: there is no hover on a touch screen, so
a layout that depended on one would be broken there.

## Things worth knowing

Four findings shaped this design. Each was measured against the live API, not assumed.

**`contributionsCollection` is unusable for private work.** For a user whose
contributions are all in private repositories, GitHub zeroes every breakdown field
and moves the real number into `restrictedContributionsCount`:

```
totalCommitContributions:            0     restrictedContributionsCount: 293
totalPullRequestContributions:       0     contributionCalendar.total:   293
totalPullRequestReviewContributions: 0
```

Build a stats panel on it and you get a page of zeros with no error. Hubble derives
everything from search instead.

**Reviews cannot be dated precisely.** GitHub search has no `reviewed:` qualifier,
so the per-month review series uses `updated:` as a proxy: it buckets by last
activity on the pull request, not by when the review happened. The chart labels it
approximate. Lifetime review totals are exact.

**Notifications are always the token owner's.** No API exposes another user's
notifications. Point the dashboard at a different username and the inbox is hidden
with an explanation rather than shown empty.

**Notification subjects need resolving to be usable.** The payload carries an API
URL but no `html_url`, and names no author, so subjects are neither clickable nor
classifiable as bot-authored on their own. One batched GraphQL query resolves them
all for a single rate-limit point.

### Known advisory

`npm audit` reports a `brace-expansion` denial-of-service reaching the tree through
ESLint's `minimatch@3`. It is accepted rather than ignored: it is a devDependency
that never ships to the browser, and it is only reachable by linting adversarial
glob patterns. It currently cannot be fixed: `brace-expansion@5` changed its export
shape, so overriding to a patched release breaks `minimatch@3` outright, and
`npm audit fix --force` resolves it only by downgrading ESLint. Worth re-checking
whenever ESLint drops `minimatch@3`.
