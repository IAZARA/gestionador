const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { authenticate, isAdmin } = require('../middlewares/auth');
const { isProjectMember, isProjectManager } = require('../middlewares/projectAccess');

// Create a new task in project
router.post('/project/:projectId', authenticate, isProjectMember, taskController.createTask);

// Get all tasks in project
router.get('/project/:projectId', authenticate, isProjectMember, taskController.getProjectTasks);

// Get tasks by status in project
router.get('/project/:projectId/status/:status', authenticate, isProjectMember, taskController.getTasksByStatus);

// Get tasks by user in project
router.get('/project/:projectId/user/:userId', authenticate, isProjectMember, taskController.getTasksByUser);

// Get my tasks
router.get('/my-tasks', authenticate, taskController.getMyTasks);

// Get task by ID
router.get('/:taskId', authenticate, taskController.getTaskById);

// Update task
router.put('/:taskId', authenticate, taskController.updateTask);

// Delete task
router.delete('/:taskId', authenticate, taskController.deleteTask);

// Change task status
router.put('/:taskId/status', authenticate, taskController.updateTaskStatus);

// Assign task to user
router.put('/:taskId/assign/:userId', authenticate, taskController.assignTask);

// Task comments
router.post('/:taskId/comments', authenticate, taskController.addTaskComment);
router.get('/:taskId/comments', authenticate, taskController.getTaskComments);

// Task files
router.post('/:taskId/files', authenticate, taskController.addTaskFile);
router.get('/:taskId/files', authenticate, taskController.getTaskFiles);
router.delete('/:taskId/files/:fileId', authenticate, taskController.deleteTaskFile);

module.exports = router;