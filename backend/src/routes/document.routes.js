const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticate, isAdmin, isAdminOrManager } = require('../middlewares/auth');
const { isProjectMember, isProjectManager } = require('../middlewares/projectAccess');
const upload = require('../middlewares/upload');
const handleUploadErrors = require('../middlewares/uploadErrorHandler');

// Get all documents (admin only)
router.get('/all', authenticate, isAdmin, documentController.getAllDocuments);

// Get all documents for a project
router.get('/project/:projectId', authenticate, isProjectMember, documentController.getProjectDocuments);

// Get all documents in folder
router.get('/folder/:folderId', authenticate, documentController.getDocumentsInFolder);

// Create a new folder
router.post('/folder', authenticate, documentController.createFolder);

// Get folder by ID
router.get('/folder/:folderId', authenticate, documentController.getFolderById);

// Update folder
router.put('/folder/:folderId', authenticate, documentController.updateFolder);

// Delete folder
router.delete('/folder/:folderId', authenticate, documentController.deleteFolder);

// Upload a new document
router.post('/', authenticate, upload.single('file'), handleUploadErrors, documentController.uploadDocument);

// Get document by ID
router.get('/:documentId', authenticate, documentController.getDocumentById);

// Download document
router.get('/:documentId/download', authenticate, documentController.downloadDocument);

// Update document metadata
router.put('/:documentId', authenticate, documentController.updateDocument);

// Delete document
router.delete('/:documentId', authenticate, documentController.deleteDocument);

// Document tags
router.post('/:documentId/tags', authenticate, documentController.addDocumentTag);
router.delete('/:documentId/tags/:tagId', authenticate, documentController.removeDocumentTag);

module.exports = router;