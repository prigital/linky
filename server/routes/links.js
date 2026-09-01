const express = require('express');
const store = require('../store');
const { requireAuth } = require('../session');

const router = express.Router();

router.use(requireAuth);

// GET /api/links
router.get('/', async function (req, res, next) {
  try {
    const links = await store.listLinks(req.user.id);
    res.json({ links });
  } catch (err) {
    next(err);
  }
});

// POST /api/links
router.post('/', async function (req, res, next) {
  const { url, title, notes, category } = req.body;

  if (!url || typeof url !== 'string' || url.trim() === '') {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    const link = await store.createLink(req.user.id, {
      url: url.trim(),
      title,
      notes,
      category,
    });
    res.status(201).json({ link });
  } catch (err) {
    next(err);
  }
});

// PUT /api/links/:id
router.put('/:id', async function (req, res, next) {
  const { id } = req.params;
  const { url, title, notes, category } = req.body;

  if (!url || typeof url !== 'string' || url.trim() === '') {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    const link = await store.updateLink(req.user.id, id, {
      url: url.trim(),
      title,
      notes,
      category,
    });

    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ link });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/links/:id
router.delete('/:id', async function (req, res, next) {
  const { id } = req.params;

  try {
    const deleted = await store.deleteLink(req.user.id, id);

    if (!deleted) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
