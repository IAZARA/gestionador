const License = require('../../models/License');
const { logger } = require('../utils/logger');

/**
 * Get all licenses
 * @route GET /api/licenses
 * @access Private
 */
exports.getLicenses = async (req, res) => {
  try {
    const licenses = await License.find();
    res.json(licenses);
  } catch (err) {
    logger.error('Error getting licenses:', err);
    res.status(500).json({ message: 'Error al obtener licencias' });
  }
};

/**
 * Get license by ID
 * @route GET /api/licenses/:id
 * @access Private
 */
exports.getLicenseById = async (req, res) => {
  try {
    const license = await License.findById(req.params.id);
    
    if (!license) {
      return res.status(404).json({ message: 'Licencia no encontrada' });
    }
    
    res.json(license);
  } catch (err) {
    logger.error(`Error getting license ${req.params.id}:`, err);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Licencia no encontrada' });
    }
    
    res.status(500).json({ message: 'Error al obtener la licencia' });
  }
};

/**
 * Create a new license
 * @route POST /api/licenses
 * @access Private
 */
exports.createLicense = async (req, res) => {
  const { userId, area, totalDays, fractions } = req.body;
  
  try {
    const newLicense = new License({
      userId,
      area,
      totalDays,
      fractions,
      createdBy: req.user.id
    });
    
    const license = await newLicense.save();
    
    // Notify via Socket.IO if available
    if (req.io) {
      req.io.emit('licenseUpdate', { action: 'create', license });
    }
    
    res.status(201).json(license);
  } catch (err) {
    logger.error('Error creating license:', err);
    res.status(500).json({ message: 'Error al crear la licencia' });
  }
};

/**
 * Update a license
 * @route PUT /api/licenses/:id
 * @access Private
 */
exports.updateLicense = async (req, res) => {
  const { userId, area, totalDays, fractions } = req.body;
  
  // Build license object
  const licenseFields = {};
  if (userId) licenseFields.userId = userId;
  if (area) licenseFields.area = area;
  if (totalDays !== undefined) licenseFields.totalDays = totalDays;
  if (fractions) licenseFields.fractions = fractions;
  
  try {
    let license = await License.findById(req.params.id);
    
    if (!license) {
      return res.status(404).json({ message: 'Licencia no encontrada' });
    }
    
    // Update
    license = await License.findByIdAndUpdate(
      req.params.id,
      { $set: licenseFields },
      { new: true }
    );
    
    // Notify via Socket.IO if available
    if (req.io) {
      req.io.emit('licenseUpdate', { action: 'update', license });
    }
    
    res.json(license);
  } catch (err) {
    logger.error(`Error updating license ${req.params.id}:`, err);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Licencia no encontrada' });
    }
    
    res.status(500).json({ message: 'Error al actualizar la licencia' });
  }
};

/**
 * Delete a license
 * @route DELETE /api/licenses/:id
 * @access Private
 */
exports.deleteLicense = async (req, res) => {
  try {
    const license = await License.findById(req.params.id);
    
    if (!license) {
      return res.status(404).json({ message: 'Licencia no encontrada' });
    }
    
    await License.findByIdAndRemove(req.params.id);
    
    // Notify via Socket.IO if available
    if (req.io) {
      req.io.emit('licenseUpdate', { action: 'delete', licenseId: req.params.id });
    }
    
    res.json({ message: 'Licencia eliminada correctamente' });
  } catch (err) {
    logger.error(`Error deleting license ${req.params.id}:`, err);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Licencia no encontrada' });
    }
    
    res.status(500).json({ message: 'Error al eliminar la licencia' });
  }
};
