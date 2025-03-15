const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, isAdmin } = require('../middlewares/auth');

// Admin dashboard statistics
router.get('/dashboard', authenticate, isAdmin, adminController.getDashboardStats);

// User management
router.get('/users', authenticate, isAdmin, adminController.getAllUsersDetails);
router.put('/users/:userId/status', authenticate, isAdmin, adminController.toggleUserStatus);
router.put('/users/:userId/role', authenticate, isAdmin, adminController.changeUserRole);

// Project management
router.get('/projects', authenticate, isAdmin, adminController.getAllProjectsDetails);
router.put('/projects/:projectId/status', authenticate, isAdmin, adminController.updateProjectStatus);

// System logs
router.get('/logs', authenticate, isAdmin, adminController.getSystemLogs);

// Activity monitoring
router.get('/activity', authenticate, isAdmin, adminController.getActivityLogs);

// User report
router.get('/reports/users', authenticate, isAdmin, adminController.generateUserReport);

// Project report
router.get('/reports/projects', authenticate, isAdmin, adminController.generateProjectReport);

// Leave management (admin panel)
router.get('/leaves', authenticate, isAdmin, adminController.getAllLeavesAdmin);

module.exports = router;