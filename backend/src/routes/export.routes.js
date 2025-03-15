const express = require('express');
const router = express.Router();
const exportController = require('../controllers/export.controller');
const { authenticate, isAdmin, hasAdministrativeAccess } = require('../middlewares/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

// Rutas para exportaciones
router.get('/projects', exportController.exportProjects);
router.get('/tasks', exportController.exportTasks);
router.get('/users', isAdmin, exportController.exportUsers);
router.get('/leaves', hasAdministrativeAccess, exportController.exportLeaves);

module.exports = router;