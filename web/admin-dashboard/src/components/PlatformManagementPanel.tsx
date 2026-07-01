import { useEffect, useMemo, useState } from 'react';
import {
  PlatformContentPage,
  PlatformContentSection,
  getPlatformManagementPages,
  updatePlatformContentPage,
  updatePlatformContentSection,
} from '../lib/api';

type PlatformManagementPanelProps = {
  token: string;
};

export function PlatformManagementPanel({ token }: PlatformManagementPanelProps) {
  const [pages, setPages] = useState<PlatformContentPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [sectionDraft, setSectionDraft] = useState({
    eyebrow: '',
    title: '',
    body: '',
    status: 'active',
    style: '{}',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null,
    [pages, selectedPageId],
  );

  const selectedSection = useMemo(
    () => selectedPage?.sections.find((section) => section.id === selectedSectionId) ?? selectedPage?.sections[0] ?? null,
    [selectedPage, selectedSectionId],
  );

  useEffect(() => {
    void loadPages();
  }, [token]);

  useEffect(() => {
    if (!selectedPageId && pages[0]) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages, selectedPageId]);

  useEffect(() => {
    if (selectedSection) {
      setSelectedSectionId(selectedSection.id);
      setSectionDraft({
        eyebrow: selectedSection.eyebrow ?? '',
        title: selectedSection.title ?? '',
        body: selectedSection.body ?? '',
        status: selectedSection.status,
        style: JSON.stringify(selectedSection.style ?? {}, null, 2),
      });
    }
  }, [selectedSection?.id]);

  async function loadPages() {
    setIsLoading(true);
    setError('');

    try {
      const response = await getPlatformManagementPages(token);
      setPages(response.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load platform pages.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePublishPage(page: PlatformContentPage) {
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await updatePlatformContentPage(token, page.id, { status: page.status === 'published' ? 'draft' : 'published' });
      setMessage(page.status === 'published' ? 'Page moved to draft.' : 'Page published.');
      await loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update page.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveSection(section: PlatformContentSection) {
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await updatePlatformContentSection(token, section.id, {
        eyebrow: sectionDraft.eyebrow,
        title: sectionDraft.title,
        body: sectionDraft.body,
        status: sectionDraft.status as PlatformContentSection['status'],
        style: JSON.parse(sectionDraft.style || '{}'),
      });

      setMessage('Section updated. Published website content can now consume this configuration.');
      await loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save section. Check style JSON syntax.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <article className="panel wide platform-management-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Platform management</h2>
          <p className="muted">
            Manage website pages, sections, text, visibility, and style metadata from the Admin Center.
            This creates the no-code layer for future website and platform appearance updates.
          </p>
        </div>
        <button type="button" onClick={loadPages} disabled={isLoading}>
          Refresh content
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <section className="platform-management-grid">
        <div className="platform-page-list">
          <h3>Pages</h3>
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={selectedPage?.id === page.id ? 'active' : ''}
              onClick={() => {
                setSelectedPageId(page.id);
                setSelectedSectionId(page.sections[0]?.id ?? null);
              }}
            >
              <span>{page.status}</span>
              <strong>{page.title}</strong>
              <small>{page.slug}</small>
            </button>
          ))}
        </div>

        <div className="platform-section-list">
          <div className="section-heading-row">
            <div>
              <h3>{selectedPage?.title ?? 'No page selected'}</h3>
              <p className="muted">{selectedPage?.description}</p>
            </div>
            {selectedPage && (
              <button type="button" onClick={() => handlePublishPage(selectedPage)} disabled={isLoading}>
                {selectedPage.status === 'published' ? 'Move to draft' : 'Publish'}
              </button>
            )}
          </div>

          <div className="section-selector-list">
            {selectedPage?.sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={selectedSection?.id === section.id ? 'active' : ''}
                onClick={() => setSelectedSectionId(section.id)}
              >
                <span>{section.status}</span>
                <strong>{section.title || section.section_key}</strong>
                <small>{section.section_key}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="platform-section-editor">
          {selectedSection ? (
            <>
              <h3>Edit section</h3>
              <label>
                Eyebrow
                <input
                  value={sectionDraft.eyebrow}
                  onChange={(event) => setSectionDraft({ ...sectionDraft, eyebrow: event.target.value })}
                />
              </label>
              <label>
                Title
                <input
                  value={sectionDraft.title}
                  onChange={(event) => setSectionDraft({ ...sectionDraft, title: event.target.value })}
                />
              </label>
              <label>
                Body
                <textarea
                  value={sectionDraft.body}
                  onChange={(event) => setSectionDraft({ ...sectionDraft, body: event.target.value })}
                />
              </label>
              <label>
                Status
                <select
                  value={sectionDraft.status}
                  onChange={(event) => setSectionDraft({ ...sectionDraft, status: event.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="draft">Draft</option>
                </select>
              </label>
              <label>
                Style JSON
                <textarea
                  value={sectionDraft.style}
                  onChange={(event) => setSectionDraft({ ...sectionDraft, style: event.target.value })}
                  spellCheck={false}
                />
              </label>

              <button type="button" onClick={() => handleSaveSection(selectedSection)} disabled={isLoading}>
                Save section
              </button>
            </>
          ) : (
            <p className="muted">Select a page section to edit its content and style metadata.</p>
          )}
        </div>
      </section>
    </article>
  );
}
