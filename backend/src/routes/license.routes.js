const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/license.controller');
const { authenticate, isAdmin, hasAdministrativeAccess } = require('../middlewares/auth');

// Get all licenses
router.get('/', authenticate, hasAdministrativeAccess, (req, res) => licenseController.getLicenses(req, res));

// Get licenses as calendar events
router.get('/calendar', authenticate, (req, res) => licenseController.getLicensesAsCalendarEvents(req, res));

// Get license by ID
router.get('/:id', authenticate, hasAdministrativeAccess, (req, res) => licenseController.getLicenseById(req, res));

// Create a new license
router.post('/', authenticate, hasAdministrativeAccess, (req, res) => licenseController.createLicense(req, res));

// Update a license
router.put('/:id', authenticate, hasAdministrativeAccess, (req, res) => licenseController.updateLicense(req, res));

// Delete a license
router.delete('/:id', authenticate, hasAdministrativeAccess, (req, res) => licenseController.deleteLicense(req, res));

module.exports = router;
