import { type FormEvent, useEffect, useState } from 'react';
import { AccessProfile, SystemNotification, createNotification, getNotifications, markNotificationRead } from '../lib/api';

type NotificationCenterPanelProps = {
  token: string;
  profile: AccessProfile;
};

export function NotificationCenterPanel({ token, profile }: NotificationCenterPanelProps) {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [title, setTitle] = useState('Daily operations reminder');
  const [body, setBody] = useState('Please confirm stock receiving, POS close, and unresolved customer messages before end of day.');
  const [tenantSlug, setTenantSlug] = useState(profile.tenant_assignments[0]?.tenant.slug ?? '');
  const [marketCode, setMarketCode] = useState('RW');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canManage = profile.permissions.includes('notifications.manage');

  async function loadNotifications() {
    setIsLoading(true);
    setError('');

    try {
      const response = await getNotifications(token);
      setNotifications(response.notifications);
      setUnreadCount(response.unread_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, [token]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) return;

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await createNotification(token, {
        title,
        body,
        tenant_slug: tenantSlug || null,
        market_code: marketCode || null,
        notification_type: 'operations',
        audience_scope: tenantSlug ? 'tenant_staff' : 'all_staff',
        status: 'published',
      });

      setMessage(response.message);
      setTitle('');
      setBody('');
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish notification.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkRead(notificationId: number) {
    setError('');

    try {
      await markNotificationRead(token, notificationId);
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark notification as read.');
    }
  }

  return (
    <article className="panel wide notification-center-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Notification Center</h2>
          <p className="muted">
            Send in-app communication now and keep the same audience model ready for SMS integration later.
          </p>
        </div>
        <button type="button" onClick={loadNotifications} disabled={isLoading}>
          {isLoading ? 'Loading...' : `Refresh (${unreadCount} unread)`}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <section className="notification-layout">
        {canManage && (
          <form className="notification-compose" onSubmit={handleCreate}>
            <label>
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <label>
              Message
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} required />
            </label>
            <div className="inline-form-grid">
              <label>
                Tenant
                <input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} placeholder="vitapharma" />
              </label>
              <label>
                Market
                <input value={marketCode} onChange={(event) => setMarketCode(event.target.value.toUpperCase())} placeholder="RW" />
              </label>
            </div>
            <button type="submit" disabled={isSaving || !title.trim() || !body.trim()}>
              {isSaving ? 'Publishing...' : 'Publish notification'}
            </button>
          </form>
        )}

        <div className="notification-list">
          {notifications.map((notification) => (
            <article key={notification.id} className={notification.read_at ? '' : 'unread'}>
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.tenant?.name ?? 'Platform'} · {notification.market?.code ?? 'All markets'}</span>
              </div>
              <p>{notification.body}</p>
              <small>{notification.notification_type} · {notification.published_at ?? 'Draft'}</small>
              {!notification.read_at && (
                <button type="button" onClick={() => handleMarkRead(notification.id)}>
                  Mark read
                </button>
              )}
            </article>
          ))}

          {notifications.length === 0 && <p className="muted">No published notifications are available for this scope.</p>}
        </div>
      </section>
    </article>
  );
}
