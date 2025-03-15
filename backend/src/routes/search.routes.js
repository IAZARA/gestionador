const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { authenticate } = require('../middlewares/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

// Ruta para búsqueda global
router.get('/global', searchController.searchGlobal);

// Ruta para búsqueda dentro de una entidad específica
router.get('/entity/:entity', searchController.searchEntity);

// Ruta para obtener sugerencias de búsqueda (para autocompletado)
router.get('/suggestions', searchController.getSearchSuggestions);

// Ruta para búsqueda avanzada
router.post('/advanced', searchController.advancedSearch);

module.exports = router;