const express = require('express');
const router = express.Router();
const licenseController = require('../src/controllers/license.controller');

// Get all licenses
router.get('/', (req, res) => licenseController.getLicenses(req, res));

// Get license by ID
router.get('/:id', (req, res) => licenseController.getLicenseById(req, res));

// Create a new license
router.post('/', (req, res) => licenseController.createLicense(req, res));

// Update a license
router.put('/:id', (req, res) => licenseController.updateLicense(req, res));

// Delete a license
router.delete('/:id', (req, res) => licenseController.deleteLicense(req, res));

module.exports = router;
