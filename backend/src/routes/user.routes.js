const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, isAdmin, hasAdministrativeAccess } = require('../middlewares/auth');

// Rutas específicas primero
router.get('/expertise/:expertiseArea', authenticate, userController.getUsersByExpertise);
router.get('/stats', authenticate, hasAdministrativeAccess, userController.getUserStats);
router.get('/export', authenticate, hasAdministrativeAccess, userController.exportUsers);

// Rutas que requieren acceso administrativo
router.get('/', authenticate, hasAdministrativeAccess, userController.getAllUsers);
router.post('/', authenticate, isAdmin, userController.createUser);

// Rutas con parámetros de usuario
router.get('/:userId/projects', authenticate, userController.getUserProjects);
router.get('/:userId/tasks', authenticate, userController.getUserTasks);
router.get('/:userId/workload', authenticate, userController.getUserWorkload);
router.get('/:userId', authenticate, userController.getUserById);
router.put('/:userId', authenticate, isAdmin, userController.updateUser);
router.delete('/:userId', authenticate, isAdmin, userController.deleteUser);
router.post('/:userId/reset-password', authenticate, isAdmin, userController.resetUserPassword);

module.exports = router;