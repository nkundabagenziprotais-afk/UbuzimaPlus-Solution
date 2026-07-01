import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  PharmacistChatConversation,
  PharmacistChatMessage,
  getPharmacistChatConversation,
  getPharmacistChatConversations,
  replyToPharmacistChat,
  updatePharmacistChatConversation,
} from '../lib/api';

type PharmacistChatPanelProps = {
  token: string;
};

export function PharmacistChatPanel({ token }: PharmacistChatPanelProps) {
  const [conversations, setConversations] = useState<PharmacistChatConversation[]>([]);
  const [selectedUuid, setSelectedUuid] = useState('');
  const [messages, setMessages] = useState<PharmacistChatMessage[]>([]);
  const [reply, setReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.uuid === selectedUuid) ?? null,
    [conversations, selectedUuid],
  );

  async function loadConversations() {
    setIsLoading(true);
    setError('');

    try {
      const response = await getPharmacistChatConversations(token);
      setConversations(response.conversations);

      const firstUuid = selectedUuid || response.conversations[0]?.uuid || '';

      if (firstUuid) {
        await loadConversation(firstUuid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load pharmacist chats.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadConversation(uuid: string) {
    const response = await getPharmacistChatConversation(token, uuid);
    setSelectedUuid(uuid);
    setMessages(response.messages);
  }

  useEffect(() => {
    void loadConversations();
  }, [token]);

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUuid) return;

    setIsSending(true);
    setError('');
    setMessage('');

    try {
      const response = await replyToPharmacistChat(token, selectedUuid, reply);
      setMessage(response.message);
      setReply('');
      await loadConversations();
      await loadConversation(selectedUuid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reply.');
    } finally {
      setIsSending(false);
    }
  }

  async function markResolved() {
    if (!selectedUuid) return;

    try {
      const response = await updatePharmacistChatConversation(token, selectedUuid, { status: 'resolved' });
      setMessage(response.message);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update chat.');
    }
  }

  return (
    <article className="panel wide chat-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Mobile pharmacist chat</h2>
          <p className="muted">
            Mobile users can open a conversation from the app, and pharmacists can respond from this queue.
          </p>
        </div>
        <button type="button" onClick={loadConversations} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="integration-note">
        Mobile endpoint ready: <code>POST /api/v1/mobile/pharmacist-chat/conversations</code>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <div className="chat-workspace">
        <aside className="chat-thread-list" aria-label="Chat conversations">
          {conversations.map((conversation) => (
            <button
              key={conversation.uuid}
              type="button"
              className={selectedUuid === conversation.uuid ? 'active' : ''}
              onClick={() => loadConversation(conversation.uuid)}
            >
              <strong>{conversation.customer_name ?? 'Mobile user'}</strong>
              <span>{conversation.priority} · {conversation.status}</span>
              <small>{conversation.latest_message?.body ?? 'No message preview'}</small>
            </button>
          ))}
          {conversations.length === 0 && <p className="muted">No active mobile pharmacist chats yet.</p>}
        </aside>

        <section className="chat-conversation">
          {selectedConversation ? (
            <>
              <div className="chat-conversation-header">
                <div>
                  <h3>{selectedConversation.customer_name ?? 'Mobile user'}</h3>
                  <p className="muted">
                    {selectedConversation.customer_phone ?? 'No phone'} · {selectedConversation.tenant?.name ?? 'No tenant'}
                  </p>
                </div>
                <button type="button" onClick={markResolved}>
                  Resolve
                </button>
              </div>

              <div className="chat-message-list">
                {messages.map((entry) => (
                  <div key={entry.uuid} className={`chat-bubble ${entry.sender_type === 'pharmacist' ? 'staff' : 'customer'}`}>
                    <span>{entry.sender_display_name ?? entry.sender_type}</span>
                    <p>{entry.body}</p>
                  </div>
                ))}
              </div>

              <form className="chat-reply-form" onSubmit={handleReply}>
                <label htmlFor="pharmacist-reply">Reply</label>
                <textarea
                  id="pharmacist-reply"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={4}
                  required
                />
                <button type="submit" disabled={isSending || !reply.trim()}>
                  {isSending ? 'Sending...' : 'Send reply'}
                </button>
              </form>
            </>
          ) : (
            <p className="muted">Select a conversation to respond.</p>
          )}
        </section>
      </div>
    </article>
  );
}
