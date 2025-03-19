const express = require('express');
const router = express.Router();
const wikiController = require('../controllers/wiki.controller');
const { authenticate } = require('../middlewares/auth');
const { isProjectMember, isProjectManager } = require('../middlewares/projectAccess');

// Global wiki routes
router.get('/global', authenticate, wikiController.getGlobalWikiPages);
router.post('/global', authenticate, wikiController.createGlobalWikiPage);
router.put('/global/:wikiId', authenticate, wikiController.updateGlobalWikiPage);
router.delete('/global/:wikiId', authenticate, wikiController.deleteGlobalWikiPage);

// Project wiki routes
router.get('/project/:projectId', authenticate, isProjectMember, wikiController.getProjectWikiPages);
router.post('/project/:projectId', authenticate, isProjectMember, wikiController.createWikiPage);
router.get('/:wikiPageId', authenticate, wikiController.getWikiPageById);
router.put('/:wikiPageId', authenticate, wikiController.updateWikiPage);
router.delete('/:wikiPageId', authenticate, wikiController.deleteWikiPage);
router.get('/:wikiPageId/history', authenticate, wikiController.getWikiPageHistory);
router.post('/:wikiPageId/revert/:versionId', authenticate, wikiController.revertToVersion);

module.exports = router;