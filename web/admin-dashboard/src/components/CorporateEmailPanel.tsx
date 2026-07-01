import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CorporateMailMessage,
  CorporateMailOverview,
  getCorporateMailOverview,
  sendCorporateMailMessage,
} from '../lib/api';

type CorporateEmailPanelProps = {
  token: string;
};

export function CorporateEmailPanel({ token }: CorporateEmailPanelProps) {
  const [overview, setOverview] = useState<CorporateMailOverview | null>(null);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeForm, setComposeForm] = useState({
    to: '',
    cc: '',
    subject: '',
    body: '',
    importance: 'normal' as 'low' | 'normal' | 'high',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedMessage = useMemo<CorporateMailMessage | null>(() => {
    return overview?.messages.find((entry) => entry.id === selectedMessageId) ?? overview?.messages[0] ?? null;
  }, [overview, selectedMessageId]);

  async function load(folder = activeFolder) {
    setIsLoading(true);
    setError('');

    try {
      const response = await getCorporateMailOverview(token, folder);
      setOverview(response);
      setActiveFolder(response.active_folder ?? folder);
      setSelectedMessageId(response.messages[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load corporate mail.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load('inbox');
  }, [token]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setError('');
    setMessage('');

    try {
      const response = await sendCorporateMailMessage(token, {
        to: splitRecipients(composeForm.to),
        cc: splitRecipients(composeForm.cc),
        subject: composeForm.subject,
        body: composeForm.body,
        importance: composeForm.importance,
      });

      setMessage(response.message);
      setComposeForm({ to: '', cc: '', subject: '', body: '', importance: 'normal' });
      setComposeOpen(false);
      await load('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send corporate mail.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <article className="panel wide mail-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Corporate email</h2>
          <p className="muted">
            Outlook-style mailbox for company communication. External Microsoft/IMAP sync is ready for credentials.
          </p>
        </div>
        <div className="panel-button-row">
          <button type="button" onClick={() => setComposeOpen((current) => !current)}>
            {composeOpen ? 'Close compose' : 'New email'}
          </button>
          <button type="button" onClick={() => load(activeFolder)} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      {overview && (
        <div className="mail-account-strip">
          <strong>{overview.account.display_name}</strong>
          <span>{overview.account.email_address}</span>
          <small>{overview.account.sync_status.replaceAll('_', ' ')}</small>
        </div>
      )}

      {composeOpen && (
        <form className="mail-compose" onSubmit={handleSend}>
          <label htmlFor="mail-to">
            To
            <input
              id="mail-to"
              type="text"
              value={composeForm.to}
              onChange={(event) => setComposeForm({ ...composeForm, to: event.target.value })}
              placeholder="name@example.com, team@example.com"
              required
            />
          </label>
          <label htmlFor="mail-cc">
            Cc
            <input
              id="mail-cc"
              type="text"
              value={composeForm.cc}
              onChange={(event) => setComposeForm({ ...composeForm, cc: event.target.value })}
              placeholder="Optional"
            />
          </label>
          <label htmlFor="mail-importance">
            Importance
            <select
              id="mail-importance"
              value={composeForm.importance}
              onChange={(event) =>
                setComposeForm({ ...composeForm, importance: event.target.value as 'low' | 'normal' | 'high' })
              }
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label htmlFor="mail-subject">
            Subject
            <input
              id="mail-subject"
              value={composeForm.subject}
              onChange={(event) => setComposeForm({ ...composeForm, subject: event.target.value })}
              required
            />
          </label>
          <label htmlFor="mail-body" className="mail-body-field">
            Message
            <textarea
              id="mail-body"
              value={composeForm.body}
              onChange={(event) => setComposeForm({ ...composeForm, body: event.target.value })}
              rows={6}
              required
            />
          </label>
          <button type="submit" disabled={isSending}>
            {isSending ? 'Saving...' : 'Send'}
          </button>
        </form>
      )}

      <div className="mail-workspace">
        <aside className="mail-folders" aria-label="Mail folders">
          {(overview?.folders ?? []).map((folder) => (
            <button
              key={folder.folder_key}
              type="button"
              className={activeFolder === folder.folder_key ? 'active' : ''}
              onClick={() => load(folder.folder_key)}
            >
              <span>{folder.name}</span>
              {folder.unread_count > 0 && <small>{folder.unread_count}</small>}
            </button>
          ))}
        </aside>

        <section className="mail-list" aria-label="Messages">
          {(overview?.messages ?? []).map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={selectedMessage?.id === entry.id ? 'active' : ''}
              onClick={() => setSelectedMessageId(entry.id)}
            >
              <strong>{entry.subject}</strong>
              <span>{entry.from_name ?? entry.from_email}</span>
              <small>{entry.body_preview}</small>
            </button>
          ))}
          {overview && overview.messages.length === 0 && <p className="muted">No messages in this folder yet.</p>}
        </section>

        <section className="mail-reading-pane" aria-label="Reading pane">
          {selectedMessage ? (
            <>
              <span>{selectedMessage.importance}</span>
              <h3>{selectedMessage.subject}</h3>
              <p className="muted">
                From {selectedMessage.from_name ?? selectedMessage.from_email} to{' '}
                {selectedMessage.to_recipients.join(', ') || overview?.account.email_address}
              </p>
              <article>{selectedMessage.body}</article>
            </>
          ) : (
            <p className="muted">Select a message to read it here.</p>
          )}
        </section>
      </div>
    </article>
  );
}

function splitRecipients(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
