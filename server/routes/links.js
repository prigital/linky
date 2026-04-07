const express = require('express');
const { db } = require('../db');

const router = express.Router();

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

router.use(requireAuth);

// GET /api/links
router.get('/', function (req, res) {
  const links = db
    .prepare(
      'SELECT * FROM links WHERE user_id = ? ORDER BY created_at DESC'
    )
    .all(req.user.id);
  res.json({ links });
});

// POST /api/links
router.post('/', function (req, res) {
  const { url, title, notes } = req.body;

  if (!url || typeof url !== 'string' || url.trim() === '') {
    return res.status(400).json({ error: 'url is required' });
  }

  const stmt = db.prepare(
    'INSERT INTO links (user_id, url, title, notes) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(req.user.id, url.trim(), title || null, notes || null);

  const newLink = db
    .prepare('SELECT * FROM links WHERE id = ?')
    .get(result.lastInsertRowid);

  res.status(201).json({ link: newLink });
});

// PUT /api/links/:id
router.put('/:id', function (req, res) {
  const { id } = req.params;
  const { url, title, notes } = req.body;

  if (!url || typeof url !== 'string' || url.trim() === '') {
    return res.status(400).json({ error: 'url is required' });
  }

  const link = db
    .prepare('SELECT * FROM links WHERE id = ? AND user_id = ?')
    .get(id, req.user.id);

  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  db.prepare(
    'UPDATE links SET url = ?, title = ?, notes = ? WHERE id = ? AND user_id = ?'
  ).run(url.trim(), title || null, notes || null, id, req.user.id);

  const updated = db.prepare('SELECT * FROM links WHERE id = ?').get(id);
  res.json({ link: updated });
});

// DELETE /api/links/:id
router.delete('/:id', function (req, res) {
  const { id } = req.params;

  const link = db
    .prepare('SELECT * FROM links WHERE id = ? AND user_id = ?')
    .get(id, req.user.id);

  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  db.prepare('DELETE FROM links WHERE id = ? AND user_id = ?').run(id, req.user.id);
  res.status(204).send();
});

module.exports = router;
