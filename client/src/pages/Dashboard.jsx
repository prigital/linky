import React, { useState, useEffect, useCallback } from 'react';
import { SquarePen, Trash2 } from 'lucide-react';

export default function Dashboard({ user, onRefreshUser }) {
  const [links, setLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editUrl, setEditUrl] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/links');
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingLinks(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    let finalUrl = url.trim();
    if (!finalUrl) {
      setError('URL is required.');
      return;
    }
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl, title: title.trim(), notes: notes.trim() }),
      });

      if (res.ok) {
        setUrl('');
        setTitle('');
        setNotes('');
        setShowForm(false);
        await fetchLinks();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save link.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(link) {
    setEditingId(link.id);
    setEditUrl(link.url);
    setEditTitle(link.title || '');
    setEditNotes(link.notes || '');
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function handleEdit(e, id) {
    e.preventDefault();
    setEditError('');

    let finalUrl = editUrl.trim();
    if (!finalUrl) {
      setEditError('URL is required.');
      return;
    }
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl, title: editTitle.trim(), notes: editNotes.trim() }),
      });

      if (res.ok) {
        setEditingId(null);
        await fetchLinks();
      } else {
        const data = await res.json();
        setEditError(data.error || 'Failed to update link.');
      }
    } catch {
      setEditError('Network error. Please try again.');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        await fetchLinks();
      }
    } catch {
      // silently fail
    }
  }

  const filteredLinks = search.trim()
    ? links.filter((l) => {
        const q = search.toLowerCase();
        return (
          l.url.toLowerCase().includes(q) ||
          (l.title && l.title.toLowerCase().includes(q)) ||
          (l.notes && l.notes.toLowerCase().includes(q))
        );
      })
    : links;

  function truncate(str, maxLen = 60) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
  }

  return (
    <div className="dashboard">
      <header className="header">
        <a href="/" className="header-brand">Linky</a>
        <div className="header-user">
          {user.avatar && (
            <img src={user.avatar} alt={user.name} className="avatar" />
          )}
          <span className="user-name">{user.name}</span>
          <a href="/auth/logout" className="btn btn-outline">
            Logout
          </a>
        </div>
      </header>

      <main className="main-content">
        <section className="links-search-section">
          <input
            className="search-input"
            type="search"
            placeholder="Search links…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </section>

        {showForm && (
          <section className="add-link-section">
            <form onSubmit={handleSubmit} className="add-link-form">
              {error && <p className="form-error">{error}</p>}
              <div className="form-group">
                <label htmlFor="url">URL *</label>
                <input
                  id="url"
                  type="text"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="title">Title</label>
                <input
                  id="title"
                  type="text"
                  placeholder="Optional title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  placeholder="Optional notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Link'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="links-section">
          <h2>Your Links</h2>
          {loadingLinks ? (
            <p className="muted">Loading…</p>
          ) : filteredLinks.length === 0 ? (
            <p className="muted">{links.length === 0 ? 'No links saved yet. Add one above!' : 'No links match your search.'}</p>
          ) : (
            <ul className="links-list">
              {filteredLinks.map((link) => (
                <li key={link.id} className="link-item">
                  {editingId === link.id ? (
                    <form className="edit-form" onSubmit={(e) => handleEdit(e, link.id)}>
                      {editError && <p className="form-error">{editError}</p>}
                      <div className="form-group">
                        <label>URL *</label>
                        <input
                          type="text"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Notes</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                          {editSubmitting ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" className="btn btn-outline" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="link-main">
                        <div className="link-title-row">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-title"
                          >
                            {link.title ? link.title : truncate(link.url)}
                          </a>
                          {link.title && (
                            <span className="link-url">{truncate(link.url)}</span>
                          )}
                        </div>
                        {link.notes && (
                          <p className="link-notes">{link.notes}</p>
                        )}
                      </div>
                      <div className="link-actions">
                        <button
                          className="btn btn-icon"
                          onClick={() => startEdit(link)}
                          aria-label="Edit link"
                        >
                          <SquarePen size={18} color="#6b7280" />
                        </button>
                        <button
                          className="btn btn-icon"
                          onClick={() => handleDelete(link.id)}
                          aria-label="Delete link"
                        >
                          <Trash2 size={18} color="#6b7280" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <button
        className="fab"
        onClick={() => setShowForm((v) => !v)}
        aria-label="Add link"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
