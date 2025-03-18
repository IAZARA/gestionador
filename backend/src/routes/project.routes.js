const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const taskController = require('../controllers/task.controller');
const wikiController = require('../controllers/wiki.controller');
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

// Project tasks
router.get('/:projectId/tasks', authenticate, isProjectMember, taskController.getProjectTasks);
router.post('/:projectId/tasks', authenticate, isProjectMember, (req, res, next) => {
  // Asegurarse de que el projectId del parámetro de ruta se incluya en el cuerpo de la solicitud
  req.body.project = req.params.projectId;
  next();
}, taskController.createTask);
router.get('/:projectId/tasks/status/:status', authenticate, isProjectMember, taskController.getTasksByStatus);
router.get('/:projectId/tasks/user/:userId', authenticate, isProjectMember, taskController.getTasksByUser);

// Project wiki
router.get('/:projectId/wiki', authenticate, isProjectMember, wikiController.getProjectWikiPages);
router.post('/:projectId/wiki', authenticate, isProjectMember, (req, res, next) => {
  // Asegurarse de que el projectId del parámetro de ruta se incluya en el cuerpo de la solicitud
  req.body.project = req.params.projectId;
  next();
}, wikiController.createWikiPage);
router.get('/:projectId/wiki/:wikiId', authenticate, isProjectMember, wikiController.getWikiPageById);
router.put('/:projectId/wiki/:wikiId', authenticate, isProjectMember, wikiController.updateWikiPage);
router.delete('/:projectId/wiki/:wikiId', authenticate, isProjectMember, wikiController.deleteWikiPage);

// Project documents
router.get('/:projectId/documents', authenticate, isProjectMember, projectController.getProjectDocuments);
router.post('/:projectId/documents', authenticate, isProjectMember, projectController.uploadDocument);
router.get('/:projectId/documents/:documentId', authenticate, isProjectMember, projectController.getDocumentById);
router.delete('/:projectId/documents/:documentId', authenticate, isProjectMember, projectController.deleteDocument);

module.exports = router;