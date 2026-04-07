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
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(link.id)}
                    aria-label="Delete link"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
