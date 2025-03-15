const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');

// Register a new user
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Get current user profile
router.get('/profile', authenticate, authController.getProfile);

// Update user profile
router.put('/profile', authenticate, authController.updateProfile);

// Change password
router.put('/change-password', authenticate, authController.changePassword);

// Request password reset
router.post('/reset-password-request', authController.requestPasswordReset);

// Reset password with token
router.post('/reset-password', authController.resetPassword);

// Logout
router.post('/logout', authenticate, authController.logout);

module.exports = router;