import React, { useState, useEffect, useCallback } from 'react';

export default function Dashboard({ user, onRefreshUser }) {
  const [links, setLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
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

  function truncate(str, maxLen = 60) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
  }

  return (
    <div className="dashboard">
      <header className="header">
        <span className="header-brand">Linky</span>
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
        <section className="add-link-section">
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            + Add Link
          </button>
          {showForm && (
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
          )}
        </section>

        <section className="links-section">
          <h2>Your Links</h2>
          {loadingLinks ? (
            <p className="muted">Loading…</p>
          ) : links.length === 0 ? (
            <p className="muted">No links saved yet. Add one above!</p>
          ) : (
            <ul className="links-list">
              {links.map((link) => (
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
                        {link.notes && (
                          <p className="link-notes">{link.notes}</p>
                        )}
                      </div>
                      <div className="link-actions">
                        <button
                          className="btn btn-outline"
                          onClick={() => startEdit(link)}
                          aria-label="Edit link"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(link.id)}
                          aria-label="Delete link"
                        >
                          Delete
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
    </div>
  );
}
