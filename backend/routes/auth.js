const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Patient = require('../models/Patient');
const { generateToken } = require('../middleware/auth');
const { validatePatientRegistration, validatePatientLogin } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new patient
// @access  Public
router.post('/register', validatePatientRegistration, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      dateOfBirth,
      gender,
      phoneNumber,
      address,
      emergencyContact,
      bloodType,
      allergies,
      chronicConditions
    } = req.body;

    // Check if patient already exists
    const existingPatient = await Patient.findByEmail(email);
    if (existingPatient) {
      return res.status(400).json({
        success: false,
        message: 'Patient with this email already exists'
      });
    }

    // Create new patient
    const patient = new Patient({
      firstName,
      lastName,
      email,
      password,
      dateOfBirth,
      gender,
      phoneNumber,
      address,
      emergencyContact,
      bloodType: bloodType || 'unknown',
      allergies: allergies || [],
      chronicConditions: chronicConditions || []
    });

    // Save patient to database
    await patient.save();

    // Generate JWT token
    const token = generateToken({
      id: patient._id,
      email: patient.email,
      role: 'patient'
    });

    // Remove password from response
    const patientResponse = patient.toObject();
    delete patientResponse.password;

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      data: {
        patient: patientResponse,
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login patient
// @access  Public
router.post('/login', validatePatientLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find patient by email (including password for comparison)
    const patient = await Patient.findByEmail(email).select('+password');
    
    if (!patient) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!patient.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await patient.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await patient.updateLastLogin();

    // Generate JWT token
    const token = generateToken({
      id: patient._id,
      email: patient.email,
      role: 'patient'
    });

    // Remove password from response
    const patientResponse = patient.toObject();
    delete patientResponse.password;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        patient: patientResponse,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = require('../middleware/auth');
    
    try {
      const decoded = verifyToken(token);
      const patient = await Patient.findById(decoded.id).select('-password');
      
      if (!patient || !patient.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token or inactive account'
        });
      }

      // Generate new token
      const newToken = generateToken({
        id: patient._id,
        email: patient.email,
        role: 'patient'
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: newToken
        }
      });
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during token refresh'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout patient (client-side token removal)
// @access  Private
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful. Please remove the token from client storage.'
  });
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const patient = await Patient.findByEmail(email);
    
    if (!patient) {
      // Don't reveal if email exists or not for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    patient.passwordResetToken = resetToken;
    patient.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await patient.save({ validateBeforeSave: false });

    // In a real application, you would send an email here
    // For now, we'll just return the token (remove this in production)
    res.json({
      success: true,
      message: 'Password reset token generated',
      data: {
        resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during password reset request'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    const patient = await Patient.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!patient) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    patient.password = newPassword;
    patient.passwordResetToken = undefined;
    patient.passwordResetExpires = undefined;
    patient.lastPasswordChange = new Date();

    await patient.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during password reset'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current patient profile
// @access  Private
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = require('../middleware/auth');
    
    try {
      const decoded = verifyToken(token);
      const patient = await Patient.findById(decoded.id).select('-password');
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      res.json({
        success: true,
        data: {
          patient
        }
      });
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
