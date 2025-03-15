const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, isAdmin, isAdminOrManager } = require('../middlewares/auth');

// Routes requiring admin access
router.get('/', authenticate, isAdmin, userController.getAllUsers);
router.post('/', authenticate, isAdmin, userController.createUser);
router.put('/:userId', authenticate, isAdmin, userController.updateUser);
router.delete('/:userId', authenticate, isAdmin, userController.deleteUser);
router.post('/:userId/reset-password', authenticate, isAdmin, userController.resetUserPassword);

// Get user by ID
router.get('/:userId', authenticate, userController.getUserById);

// Get users by expertise
router.get('/expertise/:expertiseArea', authenticate, userController.getUsersByExpertise);

// Get user projects
router.get('/:userId/projects', authenticate, userController.getUserProjects);
router.get('/me/projects', authenticate, (req, res) => {
  req.params.userId = req.user.id;
  userController.getUserProjects(req, res);
});

// Get user tasks
router.get('/:userId/tasks', authenticate, userController.getUserTasks);
router.get('/me/tasks', authenticate, (req, res) => {
  req.params.userId = req.user.id;
  userController.getUserTasks(req, res);
});

// Get user workload
router.get('/:userId/workload', authenticate, userController.getUserWorkload);
router.get('/me/workload', authenticate, (req, res) => {
  req.params.userId = req.user.id;
  userController.getUserWorkload(req, res);
});

module.exports = router;