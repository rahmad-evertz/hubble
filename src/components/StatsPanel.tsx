import { useState } from 'react'
import { MONTHS_COVERED, repoTallyTruncated } from '../api/stats'
import { monthLabel } from '../lib/dates'
import type { Stats } from '../types'
import MonthlyChart from './MonthlyChart'

type Props = { stats: Stats; org: string }

export default function StatsPanel({ stats, org }: Props) {
  const [showTable, setShowTable] = useState(false)
  const scope = org ? `in ${org}` : 'across every repo your token can see'
  const peakRepo = stats.topRepos[0]?.count ?? 1

  return (
    <>
      <div className="stat-tiles">
        <Tile value={stats.lifetime.authored} label={`Pull requests authored ${scope}`} />
        <Tile value={stats.lifetime.merged} label="Of those, merged" />
        <Tile value={stats.lifetime.reviewed} label="Pull requests reviewed" />
        <Tile value={stats.lifetime.openAuthored} label="Still open" />
      </div>

      <div className="stats-grid">
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-head">
            <h2>Last {MONTHS_COVERED} months</h2>
            <span className="note">
              reviewed counts are approximate — GitHub search can only date-filter by last activity,
              not by when you reviewed
            </span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm btn-ghost" onClick={() => setShowTable((v) => !v)}>
              {showTable ? 'Chart' : 'Table'}
            </button>
          </div>
          <div className="panel-body">
            {showTable ? (
              <table className="data">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Merged</th>
                    <th>Reviewed (approx.)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.months.map((month) => (
                    <tr key={month.key}>
                      <td>
                        {monthLabel(month.key)} {month.key.slice(0, 4)}
                      </td>
                      <td>{month.merged}</td>
                      <td>{month.reviewedApprox}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <MonthlyChart months={stats.months} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="panel-head">
            <h2>Where the merges landed</h2>
            <span className="note">
              {repoTallyTruncated(stats)
                ? 'from the 100 most recent merges'
                : `last ${MONTHS_COVERED} months`}
            </span>
          </div>
          <div className="panel-body chart">
            {stats.topRepos.length === 0 ? (
              <div style={{ color: 'var(--fg-muted)' }}>
                No merged pull requests in this window.
              </div>
            ) : (
              <div className="repo-bars">
                {stats.topRepos.map((entry) => (
                  <div className="repo-bar" key={entry.repo}>
                    <span className="name" title={entry.repo}>
                      {entry.repo.split('/')[1] ?? entry.repo}
                    </span>
                    <span className="track">
                      <span
                        className="fill"
                        style={{ width: `${(entry.count / peakRepo) * 100}%` }}
                      />
                    </span>
                    <span className="count">{entry.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="tile">
      <div className="value">{format(value)}</div>
      <div className="label">{label}</div>
    </div>
  )
}

function format(value: number): string {
  return value >= 10_000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString()
}
