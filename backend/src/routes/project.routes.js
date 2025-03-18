const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const taskController = require('../controllers/task.controller');
const wikiController = require('../controllers/wiki.controller');
const { authenticate, isAdmin, isAdminOrManager } = require('../middlewares/auth');
const { isProjectMember, isProjectManager } = require('../middlewares/projectAccess');
const auditLogger = require('../middlewares/auditLogger');

// Middleware para registrar actividad en proyectos
const projectAudit = auditLogger({ entityType: 'project', entityIdParam: 'projectId' });
const taskAudit = auditLogger({ entityType: 'task', entityIdParam: 'taskId' });
const wikiAudit = auditLogger({ entityType: 'wiki_page', entityIdParam: 'wikiId' });
const documentAudit = auditLogger({ entityType: 'document', entityIdParam: 'documentId' });

// Create a new project
router.post('/', authenticate, isAdminOrManager, projectAudit, projectController.createProject);

// Get all projects (admin only)
router.get('/all', authenticate, isAdmin, projectController.getAllProjects);

// Get projects for current user
router.get('/', authenticate, projectController.getUserProjects);

// Get project by ID
router.get('/:projectId', authenticate, isProjectMember, projectAudit, projectController.getProjectById);

// Update project
router.put('/:projectId', authenticate, isProjectManager, projectAudit, projectController.updateProject);

// Delete project
router.delete('/:projectId', authenticate, isProjectManager, projectAudit, projectController.deleteProject);

// Project members
router.get('/:projectId/members', authenticate, isProjectMember, projectController.getProjectMembers);
router.post('/:projectId/members', authenticate, isProjectManager, projectAudit, projectController.addProjectMember);
router.delete('/:projectId/members/:userId', authenticate, isProjectManager, projectAudit, projectController.removeProjectMember);
router.put('/:projectId/members/:userId/role', authenticate, isProjectManager, projectAudit, projectController.updateMemberRole);

// Project statistics and reports
router.get('/:projectId/stats', authenticate, isProjectMember, projectController.getProjectStats);
router.get('/:projectId/report', authenticate, isProjectMember, projectController.generateProjectReport);

// Project activity
router.get('/:projectId/activity', authenticate, isProjectMember, projectController.getProjectActivity);

// Project tasks
router.get('/:projectId/tasks', authenticate, isProjectMember, taskController.getProjectTasks);
router.post('/:projectId/tasks', authenticate, isProjectMember, taskAudit, (req, res, next) => {
  // Asegurarse de que el projectId del parámetro de ruta se incluya en el cuerpo de la solicitud
  req.body.project = req.params.projectId;
  next();
}, taskController.createTask);
router.get('/:projectId/tasks/status/:status', authenticate, isProjectMember, taskController.getTasksByStatus);
router.get('/:projectId/tasks/user/:userId', authenticate, isProjectMember, taskController.getTasksByUser);
router.delete('/:projectId/tasks/:taskId', authenticate, isProjectMember, taskAudit, taskController.deleteTask);

// Project wiki
router.get('/:projectId/wiki', authenticate, isProjectMember, wikiController.getProjectWikiPages);
router.post('/:projectId/wiki', authenticate, isProjectMember, wikiAudit, (req, res, next) => {
  // Asegurarse de que el projectId del parámetro de ruta se incluya en el cuerpo de la solicitud
  req.body.project = req.params.projectId;
  next();
}, wikiController.createWikiPage);
router.get('/:projectId/wiki/:wikiId', authenticate, isProjectMember, wikiController.getWikiPageById);
router.put('/:projectId/wiki/:wikiId', authenticate, isProjectMember, wikiAudit, wikiController.updateWikiPage);
router.delete('/:projectId/wiki/:wikiId', authenticate, isProjectMember, wikiAudit, wikiController.deleteWikiPage);

// Project documents
router.get('/:projectId/documents', authenticate, isProjectMember, projectController.getProjectDocuments);
router.post('/:projectId/documents', authenticate, isProjectMember, documentAudit, projectController.uploadDocument);
router.get('/:projectId/documents/:documentId', authenticate, isProjectMember, projectController.getDocumentById);
router.delete('/:projectId/documents/:documentId', authenticate, isProjectMember, documentAudit, projectController.deleteDocument);

module.exports = router;