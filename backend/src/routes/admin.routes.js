const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, isAdmin, hasAdministrativeAccess } = require('../middlewares/auth');

// Admin dashboard statistics
router.get('/dashboard', authenticate, hasAdministrativeAccess, adminController.getDashboardStats);

// User management
router.get('/users', authenticate, hasAdministrativeAccess, adminController.getAllUsersDetails);
router.put('/users/:userId/status', authenticate, isAdmin, adminController.toggleUserStatus);
router.put('/users/:userId/role', authenticate, isAdmin, adminController.changeUserRole);

// Project management
router.get('/projects', authenticate, hasAdministrativeAccess, adminController.getAllProjectsDetails);
router.put('/projects/:projectId/status', authenticate, isAdmin, adminController.updateProjectStatus);

// System logs
router.get('/logs', authenticate, hasAdministrativeAccess, adminController.getSystemLogs);

// Activity monitoring
router.get('/activity', authenticate, hasAdministrativeAccess, adminController.getActivityLogs);

// User report
router.get('/reports/users', authenticate, isAdmin, adminController.generateUserReport);

// Project report
router.get('/reports/projects', authenticate, hasAdministrativeAccess, adminController.generateProjectReport);

// Leave management (admin panel)
router.get('/leaves', authenticate, hasAdministrativeAccess, adminController.getAllLeavesAdmin);

module.exports = router;