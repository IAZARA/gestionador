const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const { authenticate } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const handleUploadErrors = require('../middlewares/uploadErrorHandler');

// Upload a new file
router.post('/upload', authenticate, upload.single('file'), handleUploadErrors, fileController.uploadFile);

// Get file by ID
router.get('/:fileId', authenticate, fileController.getFileById);

// Download file
router.get('/:fileId/download', authenticate, fileController.downloadFile);

// Update file metadata
router.put('/:fileId', authenticate, fileController.updateFile);

// Delete file
router.delete('/:fileId', authenticate, fileController.deleteFile);

// Get files by entity (project, task, etc.)
router.get('/entity/:entityType/:entityId', authenticate, fileController.getEntityFiles);

module.exports = router;