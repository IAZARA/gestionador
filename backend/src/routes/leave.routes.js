const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leave.controller');
const { authenticate, isAdmin, isAdminOrManager } = require('../middlewares/auth');

// Get all leaves (admin only)
router.get('/all', authenticate, isAdmin, leaveController.getAllLeaves);

// Get leaves for a specific user (admin or manager only)
router.get('/user/:userId', authenticate, isAdminOrManager, leaveController.getUserLeaves);

// Get my leaves
router.get('/my-leaves', authenticate, leaveController.getMyLeaves);

// Request a leave
router.post('/', authenticate, leaveController.requestLeave);

// Get a leave by ID
router.get('/:leaveId', authenticate, leaveController.getLeaveById);

// Update a leave request (own request or admin/manager)
router.put('/:leaveId', authenticate, leaveController.updateLeave);

// Delete a leave request
router.delete('/:leaveId', authenticate, leaveController.deleteLeave);

// Approve/deny a leave request (admin or manager only)
router.put('/:leaveId/status', authenticate, isAdminOrManager, leaveController.updateLeaveStatus);

// Get leave statistics (admin or manager only)
router.get('/stats', authenticate, isAdminOrManager, leaveController.getLeaveStatistics);

// Get leave calendar (all approved leaves)
router.get('/calendar', authenticate, leaveController.getLeaveCalendar);

module.exports = router;