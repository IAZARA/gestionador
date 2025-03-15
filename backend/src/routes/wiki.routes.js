const express = require('express');
const router = express.Router();
const wikiController = require('../controllers/wiki.controller');
const { authenticate } = require('../middlewares/auth');
const { isProjectMember, isProjectManager } = require('../middlewares/projectAccess');

// Get all wiki pages for a project
router.get('/project/:projectId', authenticate, isProjectMember, wikiController.getProjectWikiPages);

// Create a new wiki page
router.post('/project/:projectId', authenticate, isProjectMember, wikiController.createWikiPage);

// Get wiki page by ID
router.get('/:wikiPageId', authenticate, wikiController.getWikiPageById);

// Update wiki page
router.put('/:wikiPageId', authenticate, wikiController.updateWikiPage);

// Delete wiki page
router.delete('/:wikiPageId', authenticate, wikiController.deleteWikiPage);

// Get wiki page history
router.get('/:wikiPageId/history', authenticate, wikiController.getWikiPageHistory);

// Revert to previous version
router.post('/:wikiPageId/revert/:versionId', authenticate, wikiController.revertToVersion);

module.exports = router;