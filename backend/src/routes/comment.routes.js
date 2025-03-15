const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment.controller');
const { authenticate } = require('../middlewares/auth');

// Create comment
router.post('/', authenticate, commentController.createComment);

// Get comment by ID
router.get('/:commentId', authenticate, commentController.getCommentById);

// Update comment
router.put('/:commentId', authenticate, commentController.updateComment);

// Delete comment
router.delete('/:commentId', authenticate, commentController.deleteComment);

// Get all comments for a specific entity
router.get('/entity/:entityType/:entityId', authenticate, commentController.getEntityComments);

module.exports = router;