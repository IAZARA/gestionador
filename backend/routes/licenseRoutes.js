const express = require('express');
const router = express.Router();
const License = require('../models/License');
const auth = require('../middleware/auth');

// Get all licenses
router.get('/', auth, async (req, res) => {
  try {
    const licenses = await License.find();
    res.json(licenses);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error del servidor');
  }
});

// Get license by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const license = await License.findById(req.params.id);
    
    if (!license) {
      return res.status(404).json({ msg: 'Licencia no encontrada' });
    }
    
    res.json(license);
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Licencia no encontrada' });
    }
    
    res.status(500).send('Error del servidor');
  }
});

// Create a new license
router.post('/', auth, async (req, res) => {
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
    res.json(license);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error del servidor');
  }
});

// Update a license
router.put('/:id', auth, async (req, res) => {
  const { userId, area, totalDays, fractions } = req.body;
  
  // Build license object
  const licenseFields = {};
  if (userId) licenseFields.userId = userId;
  if (area) licenseFields.area = area;
  if (totalDays) licenseFields.totalDays = totalDays;
  if (fractions) licenseFields.fractions = fractions;
  
  try {
    let license = await License.findById(req.params.id);
    
    if (!license) {
      return res.status(404).json({ msg: 'Licencia no encontrada' });
    }
    
    // Update
    license = await License.findByIdAndUpdate(
      req.params.id,
      { $set: licenseFields },
      { new: true }
    );
    
    res.json(license);
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Licencia no encontrada' });
    }
    
    res.status(500).send('Error del servidor');
  }
});

// Delete a license
router.delete('/:id', auth, async (req, res) => {
  try {
    const license = await License.findById(req.params.id);
    
    if (!license) {
      return res.status(404).json({ msg: 'Licencia no encontrada' });
    }
    
    await License.findByIdAndRemove(req.params.id);
    
    res.json({ msg: 'Licencia eliminada' });
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Licencia no encontrada' });
    }
    
    res.status(500).send('Error del servidor');
  }
});

module.exports = router;
