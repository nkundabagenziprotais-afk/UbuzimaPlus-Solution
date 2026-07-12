import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getSecurityAuditTimeline,
  type SecurityAuditEvent,
  type SecurityAuditTimelineResponse,
} from '../lib/api';

type Props = {
  token: string;
  tenantSlug: string;
};

function dateLabel(
  value: string | null,
): string {
  if (!value) {
    return 'Time unavailable';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : date.toLocaleString();
}

function actionLabel(
  action: string,
): string {
  return action
    .replace(/^security\./, '')
    .replace(/\./g, ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function csvCell(
  value: unknown,
): string {
  const normalized =
    value === null
    || value === undefined
      ? ''
      : String(value);

  return `"${normalized.replace(
    /"/g,
    '""',
  )}"`;
}

export function SecurityAuditTimeline({
  token,
  tenantSlug,
}: Props) {
  const [data, setData] =
    useState<SecurityAuditTimelineResponse | null>(
      null,
    );

  const [search, setSearch] = useState('');
  const [category, setCategory] =
    useState('all');

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] = useState('');

  async function loadTimeline(
    limit = 150,
  ) {
    setIsLoading(true);
    setError('');

    try {
      setData(
        await getSecurityAuditTimeline(
          token,
          tenantSlug,
          {
            search:
              search.trim()
              || undefined,
            limit,
          },
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load security audit history.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(
      () => {
        void loadTimeline();
      },
      250,
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [token, tenantSlug, search]);

  const events = useMemo(
    () =>
      (data?.events ?? []).filter(
        (event) =>
          category === 'all'
          || event.category === category,
      ),
    [category, data],
  );

  function exportCsv() {
    const header = [
      'Date',
      'Category',
      'Action',
      'Actor',
      'Actor Email',
      'Target User',
      'Target Role',
      'IP Address',
    ];

    const rows = events.map(
      (event: SecurityAuditEvent) => [
        event.created_at ?? '',
        event.category,
        event.action,
        event.actor?.name ?? '',
        event.actor?.email ?? '',
        event.target.user?.name ?? '',
        event.target.role_name ?? '',
        event.ip_address ?? '',
      ],
    );

    const csv = [
      header,
      ...rows,
    ]
      .map(
        (row) =>
          row.map(csvCell).join(','),
      )
      .join('\n');

    const blob = new Blob(
      [csv],
      {
        type:
          'text/csv;charset=utf-8',
      },
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href = url;
    anchor.download =
      `ubuzimaplus-security-audit-${tenantSlug}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="security-audit-timeline">
      <header>
        <div>
          <p className="eyebrow">
            Immutable operational evidence
          </p>
          <h2>
            Security Audit Timeline
          </h2>
          <span>
            Review who changed user access,
            roles, sessions, devices, 2FA,
            passwords, and tenant security
            controls.
          </span>
        </div>

        <button
          type="button"
          disabled={events.length === 0}
          onClick={exportCsv}
        >
          Export CSV
        </button>
      </header>

      {error && (
        <div className="notice error">
          {error}
        </div>
      )}

      <div className="security-audit-summary">
        <article>
          <span>Events</span>
          <strong>
            {data?.summary.event_count ?? 0}
          </strong>
        </article>

        <article>
          <span>User events</span>
          <strong>
            {data?.summary.user_events ?? 0}
          </strong>
        </article>

        <article>
          <span>Role events</span>
          <strong>
            {data?.summary.role_events ?? 0}
          </strong>
        </article>

        <article>
          <span>Unique actors</span>
          <strong>
            {data?.summary.unique_actors
              ?? 0}
          </strong>
        </article>
      </div>

      <div className="security-audit-toolbar">
        <label>
          Search audit evidence
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Action, user, email, role…"
          />
        </label>

        <label>
          Event category
          <select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value,
              )
            }
          >
            <option value="all">
              All events
            </option>
            <option value="user">
              User security
            </option>
            <option value="role">
              Role governance
            </option>
            <option value="security">
              Other security
            </option>
          </select>
        </label>

        <button
          type="button"
          disabled={isLoading}
          onClick={() =>
            void loadTimeline()
          }
        >
          {isLoading
            ? 'Refreshing…'
            : 'Refresh timeline'}
        </button>
      </div>

      <div className="security-audit-event-list">
        {isLoading && !data ? (
          <div className="security-operations-state">
            Loading security audit history…
          </div>
        ) : events.length === 0 ? (
          <div className="security-operations-state">
            No security audit events match
            the current filters.
          </div>
        ) : (
          events.map((event) => (
            <article key={event.id}>
              <i
                className={
                  `is-${event.category}`
                }
              />

              <div>
                <header>
                  <strong>
                    {actionLabel(
                      event.action,
                    )}
                  </strong>

                  <span>
                    {dateLabel(
                      event.created_at,
                    )}
                  </span>
                </header>

                <p>
                  <strong>
                    {event.actor?.name
                      ?? 'System'}
                  </strong>
                  {' '}performed this action
                  {event.target.user
                    ? ` for ${event.target.user.name}`
                    : event.target.role_name
                      ? ` on role ${event.target.role_name}`
                      : ''}
                  .
                </p>

                <footer>
                  <span>
                    {event.category}
                  </span>

                  {event.ip_address && (
                    <span>
                      IP {event.ip_address}
                    </span>
                  )}

                  {event.actor?.email && (
                    <span>
                      {event.actor.email}
                    </span>
                  )}
                </footer>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
