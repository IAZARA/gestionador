const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth');

// Get all notifications for current user
router.get('/', authenticate, notificationController.getUserNotifications);

// Mark notification as read
router.put('/:notificationId/read', authenticate, notificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', authenticate, notificationController.markAllAsRead);

// Delete a notification
router.delete('/:notificationId', authenticate, notificationController.deleteNotification);

// Get notification count
router.get('/count', authenticate, notificationController.getNotificationCount);

module.exports = router;