const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const { authenticate, isAdmin, isAdminOrManager } = require('../middlewares/auth');
const { isProjectMember, isProjectManager } = require('../middlewares/projectAccess');

// Create a new project
router.post('/', authenticate, isAdminOrManager, projectController.createProject);

// Get all projects (admin only)
router.get('/all', authenticate, isAdmin, projectController.getAllProjects);

// Get projects for current user
router.get('/', authenticate, projectController.getUserProjects);

// Get project by ID
router.get('/:projectId', authenticate, isProjectMember, projectController.getProjectById);

// Update project
router.put('/:projectId', authenticate, isProjectManager, projectController.updateProject);

// Delete project
router.delete('/:projectId', authenticate, isProjectManager, projectController.deleteProject);

// Project members
router.get('/:projectId/members', authenticate, isProjectMember, projectController.getProjectMembers);
router.post('/:projectId/members', authenticate, isProjectManager, projectController.addProjectMember);
router.delete('/:projectId/members/:userId', authenticate, isProjectManager, projectController.removeProjectMember);
router.put('/:projectId/members/:userId/role', authenticate, isProjectManager, projectController.updateMemberRole);

// Project statistics and reports
router.get('/:projectId/stats', authenticate, isProjectMember, projectController.getProjectStats);
router.get('/:projectId/report', authenticate, isProjectMember, projectController.generateProjectReport);

// Project activity
router.get('/:projectId/activity', authenticate, isProjectMember, projectController.getProjectActivity);

module.exports = router;