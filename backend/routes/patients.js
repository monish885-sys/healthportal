const express = require('express');
const Patient = require('../models/Patient');
const SymptomRecord = require('../models/SymptomRecord');
const { authenticate } = require('../middleware/auth');
const { validateSymptomRecord, validateObjectId, validatePagination } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/patients/profile
// @desc    Get patient profile
// @access  Private
router.get('/profile', authenticate, async (req, res) => {
  try {
    const patient = await Patient.findById(req.patient._id).select('-password');
    
    res.json({
      success: true,
      data: {
        patient
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   PUT /api/patients/profile
// @desc    Update patient profile
// @access  Private
router.put('/profile', authenticate, async (req, res) => {
  try {
    const allowedUpdates = [
      'firstName', 'lastName', 'phoneNumber', 'address', 
      'bloodType', 'allergies', 'chronicConditions', 'emergencyContact'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const patient = await Patient.findByIdAndUpdate(
      req.patient._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        patient
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   POST /api/patients/change-password
// @desc    Change patient password
// @access  Private
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    // Get patient with password
    const patient = await Patient.findById(req.patient._id).select('+password');
    
    // Verify current password
    const isCurrentPasswordValid = await patient.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    patient.password = newPassword;
    patient.lastPasswordChange = new Date();
    await patient.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   POST /api/patients/symptoms
// @desc    Submit symptom record
// @access  Private
router.post('/symptoms', authenticate, validateSymptomRecord, async (req, res) => {
  try {
    const symptomData = {
      ...req.body,
      patientId: req.patient._id
    };

    const symptomRecord = new SymptomRecord(symptomData);
    await symptomRecord.save();

    // Trigger ML analysis using the ML service
    const mlService = require('../services/mlService');
    await mlService.initialize();
    
    // Get active ML model
    const MLModel = require('../models/MLModel');
    const activeModel = await MLModel.findActive();
    
    if (activeModel) {
      console.log('🤖 Using ML model for analysis:', activeModel.name, 'v' + activeModel.version);
      const mlAnalysis = await mlService.analyzeSymptoms(symptomRecord, activeModel);
      symptomRecord.mlAnalysis = mlAnalysis;
    } else {
      console.log('⚠️  No active ML model found, using fallback analysis');
      // Fallback analysis if no model is available
      const mlAnalysis = {
        riskScore: Math.random() * 0.8,
        predictedSyndrome: 'Unknown',
        confidence: 0.5,
        recommendations: ['Manual review recommended - no ML model available'],
        flaggedForReview: true,
        analysisTimestamp: new Date()
      };
      symptomRecord.mlAnalysis = mlAnalysis;
    }
    
    await symptomRecord.save();

    res.status(201).json({
      success: true,
      message: 'Symptom record submitted successfully',
      data: {
        symptomRecord
      }
    });
  } catch (error) {
    console.error('Submit symptoms error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/patients/symptoms
// @desc    Get patient symptom records
// @access  Private
router.get('/symptoms', authenticate, validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'recordedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const query = { patientId: req.patient._id };
    
    // Add date range filter if provided
    if (req.query.startDate) {
      query.recordedAt = { ...query.recordedAt, $gte: new Date(req.query.startDate) };
    }
    if (req.query.endDate) {
      query.recordedAt = { ...query.recordedAt, $lte: new Date(req.query.endDate) };
    }

    // Add risk score filter if provided
    if (req.query.minRiskScore) {
      query['mlAnalysis.riskScore'] = { ...query['mlAnalysis.riskScore'], $gte: parseFloat(req.query.minRiskScore) };
    }

    const symptomRecords = await SymptomRecord.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .populate('patientId', 'firstName lastName email');

    const total = await SymptomRecord.countDocuments(query);

    res.json({
      success: true,
      data: {
        symptomRecords,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get symptoms error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/patients/symptoms/:id
// @desc    Get specific symptom record
// @access  Private
router.get('/symptoms/:id', authenticate, validateObjectId, async (req, res) => {
  try {
    const symptomRecord = await SymptomRecord.findOne({
      _id: req.params.id,
      patientId: req.patient._id
    }).populate('patientId', 'firstName lastName email');

    if (!symptomRecord) {
      return res.status(404).json({
        success: false,
        message: 'Symptom record not found'
      });
    }

    res.json({
      success: true,
      data: {
        symptomRecord
      }
    });
  } catch (error) {
    console.error('Get symptom record error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/patients/dashboard
// @desc    Get patient dashboard data
// @access  Private
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const patientId = req.patient._id;
    
    // Get recent symptom records
    const recentSymptoms = await SymptomRecord.find({ patientId })
      .sort({ recordedAt: -1 })
      .limit(5)
      .select('symptoms recordedAt mlAnalysis.riskScore mlAnalysis.predictedSyndrome');

    // Get statistics
    const totalRecords = await SymptomRecord.countDocuments({ patientId });
    const highRiskRecords = await SymptomRecord.countDocuments({ 
      patientId, 
      'mlAnalysis.riskScore': { $gte: 0.7 } 
    });
    const flaggedRecords = await SymptomRecord.countDocuments({ 
      patientId, 
      'mlAnalysis.flaggedForReview': true 
    });

    // Get average risk score
    const avgRiskResult = await SymptomRecord.aggregate([
      { $match: { patientId } },
      { $group: { _id: null, avgRisk: { $avg: '$mlAnalysis.riskScore' } } }
    ]);
    const averageRiskScore = avgRiskResult.length > 0 ? avgRiskResult[0].avgRisk : 0;

    // Get symptom trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const symptomTrends = await SymptomRecord.aggregate([
      { 
        $match: { 
          patientId, 
          recordedAt: { $gte: thirtyDaysAgo } 
        } 
      },
      { $unwind: '$symptoms' },
      { 
        $group: { 
          _id: '$symptoms.name', 
          count: { $sum: 1 },
          avgSeverity: { $avg: '$symptoms.severity' }
        } 
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        recentSymptoms,
        statistics: {
          totalRecords,
          highRiskRecords,
          flaggedRecords,
          averageRiskScore: Math.round(averageRiskScore * 100) / 100
        },
        symptomTrends
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   DELETE /api/patients/account
// @desc    Deactivate patient account
// @access  Private
router.delete('/account', authenticate, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to deactivate account'
      });
    }

    // Get patient with password
    const patient = await Patient.findById(req.patient._id).select('+password');
    
    // Verify password
    const isPasswordValid = await patient.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    // Deactivate account
    patient.isActive = false;
    await patient.save();

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
