const express = require('express');
const SymptomRecord = require('../models/SymptomRecord');
const MLModel = require('../models/MLModel');
const { authenticate } = require('../middleware/auth');
const { validatePagination } = require('../middleware/validation');
const MLService = require('../services/mlService');

const router = express.Router();

// @route   POST /api/ml/analyze
// @desc    Analyze symptom record with ML model
// @access  Private
router.post('/analyze', authenticate, async (req, res) => {
  try {
    const { symptomRecordId } = req.body;

    if (!symptomRecordId) {
      return res.status(400).json({
        success: false,
        message: 'Symptom record ID is required'
      });
    }

    // Get symptom record
    const symptomRecord = await SymptomRecord.findOne({
      _id: symptomRecordId,
      patientId: req.patient._id
    });

    if (!symptomRecord) {
      return res.status(404).json({
        success: false,
        message: 'Symptom record not found'
      });
    }

    // Get active ML model
    const activeModel = await MLModel.findActive();
    if (!activeModel) {
      return res.status(503).json({
        success: false,
        message: 'No active ML model available'
      });
    }

    // Perform ML analysis
    const analysisResult = await MLService.analyzeSymptoms(symptomRecord, activeModel);

    // Update symptom record with analysis results
    symptomRecord.mlAnalysis = analysisResult;
    await symptomRecord.save();

    // Update model usage statistics
    await activeModel.updateUsage(true);

    res.json({
      success: true,
      message: 'Symptom analysis completed',
      data: {
        analysis: analysisResult,
        modelInfo: {
          name: activeModel.name,
          version: activeModel.version,
          accuracy: activeModel.performance.accuracy
        }
      }
    });
  } catch (error) {
    console.error('ML analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during analysis'
    });
  }
});

// @route   GET /api/ml/surveillance
// @desc    Get syndromic surveillance data
// @access  Private
router.get('/surveillance', authenticate, validatePagination, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      zipCode,
      minRiskScore,
      syndrome,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};
    const skip = (page - 1) * limit;

    // Date range filter
    if (startDate || endDate) {
      query.recordedAt = {};
      if (startDate) query.recordedAt.$gte = new Date(startDate);
      if (endDate) query.recordedAt.$lte = new Date(endDate);
    }

    // Location filter
    if (zipCode) {
      query['location.zipCode'] = zipCode;
    }

    // Risk score filter
    if (minRiskScore) {
      query['mlAnalysis.riskScore'] = { $gte: parseFloat(minRiskScore) };
    }

    // Syndrome filter
    if (syndrome) {
      query['mlAnalysis.predictedSyndrome'] = new RegExp(syndrome, 'i');
    }

    // Get surveillance data
    const surveillanceData = await SymptomRecord.find(query)
      .populate('patientId', 'firstName lastName age gender')
      .sort({ recordedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SymptomRecord.countDocuments(query);

    // Get aggregated statistics
    const stats = await SymptomRecord.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          avgRiskScore: { $avg: '$mlAnalysis.riskScore' },
          highRiskCount: {
            $sum: {
              $cond: [{ $gte: ['$mlAnalysis.riskScore', 0.7] }, 1, 0]
            }
          },
          flaggedCount: {
            $sum: {
              $cond: ['$mlAnalysis.flaggedForReview', 1, 0]
            }
          }
        }
      }
    ]);

    // Get syndrome distribution
    const syndromeDistribution = await SymptomRecord.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$mlAnalysis.predictedSyndrome',
          count: { $sum: 1 },
          avgRiskScore: { $avg: '$mlAnalysis.riskScore' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get geographic distribution
    const geographicDistribution = await SymptomRecord.aggregate([
      { $match: { ...query, 'location.zipCode': { $exists: true } } },
      {
        $group: {
          _id: '$location.zipCode',
          count: { $sum: 1 },
          avgRiskScore: { $avg: '$mlAnalysis.riskScore' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      data: {
        surveillanceData,
        statistics: stats[0] || {
          totalRecords: 0,
          avgRiskScore: 0,
          highRiskCount: 0,
          flaggedCount: 0
        },
        syndromeDistribution,
        geographicDistribution,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Surveillance data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/ml/trends
// @desc    Get syndromic trends over time
// @access  Private
router.get('/trends', authenticate, async (req, res) => {
  try {
    const { 
      days = 30, 
      zipCode, 
      syndrome,
      granularity = 'daily' // daily, weekly, monthly
    } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const query = {
      recordedAt: { $gte: startDate }
    };

    if (zipCode) {
      query['location.zipCode'] = zipCode;
    }

    if (syndrome) {
      query['mlAnalysis.predictedSyndrome'] = new RegExp(syndrome, 'i');
    }

    // Determine date grouping based on granularity
    let dateGrouping;
    switch (granularity) {
      case 'hourly':
        dateGrouping = {
          year: { $year: '$recordedAt' },
          month: { $month: '$recordedAt' },
          day: { $dayOfMonth: '$recordedAt' },
          hour: { $hour: '$recordedAt' }
        };
        break;
      case 'daily':
        dateGrouping = {
          year: { $year: '$recordedAt' },
          month: { $month: '$recordedAt' },
          day: { $dayOfMonth: '$recordedAt' }
        };
        break;
      case 'weekly':
        dateGrouping = {
          year: { $year: '$recordedAt' },
          week: { $week: '$recordedAt' }
        };
        break;
      case 'monthly':
        dateGrouping = {
          year: { $year: '$recordedAt' },
          month: { $month: '$recordedAt' }
        };
        break;
      default:
        dateGrouping = {
          year: { $year: '$recordedAt' },
          month: { $month: '$recordedAt' },
          day: { $dayOfMonth: '$recordedAt' }
        };
    }

    const trends = await SymptomRecord.aggregate([
      { $match: query },
      {
        $group: {
          _id: dateGrouping,
          count: { $sum: 1 },
          avgRiskScore: { $avg: '$mlAnalysis.riskScore' },
          highRiskCount: {
            $sum: {
              $cond: [{ $gte: ['$mlAnalysis.riskScore', 0.7] }, 1, 0]
            }
          },
          flaggedCount: {
            $sum: {
              $cond: ['$mlAnalysis.flaggedForReview', 1, 0]
            }
          }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Get syndrome trends
    const syndromeTrends = await SymptomRecord.aggregate([
      { $match: query },
      { $unwind: '$symptoms' },
      {
        $group: {
          _id: {
            ...dateGrouping,
            symptom: '$symptoms.name'
          },
          count: { $sum: 1 },
          avgSeverity: { $avg: '$symptoms.severity' }
        }
      },
      { $sort: { '_id': 1, count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        trends,
        syndromeTrends,
        parameters: {
          days: parseInt(days),
          zipCode,
          syndrome,
          granularity
        }
      }
    });
  } catch (error) {
    console.error('Trends analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/ml/alerts
// @desc    Get high-risk alerts and flagged cases
// @access  Private
router.get('/alerts', authenticate, validatePagination, async (req, res) => {
  try {
    const {
      alertType = 'all', // all, high_risk, flagged, new_syndrome
      page = 1,
      limit = 20
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {};

    switch (alertType) {
      case 'high_risk':
        query['mlAnalysis.riskScore'] = { $gte: 0.7 };
        break;
      case 'flagged':
        query['mlAnalysis.flaggedForReview'] = true;
        break;
      case 'new_syndrome':
        // This would require additional logic to identify new syndromes
        query['mlAnalysis.predictedSyndrome'] = { $exists: true };
        break;
      default:
        query = {
          $or: [
            { 'mlAnalysis.riskScore': { $gte: 0.7 } },
            { 'mlAnalysis.flaggedForReview': true }
          ]
        };
    }

    const alerts = await SymptomRecord.find(query)
      .populate('patientId', 'firstName lastName email phoneNumber')
      .sort({ recordedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SymptomRecord.countDocuments(query);

    // Get alert summary
    const alertSummary = await SymptomRecord.aggregate([
      {
        $group: {
          _id: null,
          totalHighRisk: {
            $sum: {
              $cond: [{ $gte: ['$mlAnalysis.riskScore', 0.7] }, 1, 0]
            }
          },
          totalFlagged: {
            $sum: {
              $cond: ['$mlAnalysis.flaggedForReview', 1, 0]
            }
          },
          avgRiskScore: { $avg: '$mlAnalysis.riskScore' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        alerts,
        summary: alertSummary[0] || {
          totalHighRisk: 0,
          totalFlagged: 0,
          avgRiskScore: 0
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/ml/models
// @desc    Get available ML models
// @access  Private
router.get('/models', authenticate, async (req, res) => {
  try {
    const models = await MLModel.find()
      .select('-modelPath -configPath')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        models
      }
    });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/ml/models/:id
// @desc    Get specific ML model details
// @access  Private
router.get('/models/:id', authenticate, async (req, res) => {
  try {
    const model = await MLModel.findById(req.params.id)
      .select('-modelPath -configPath');

    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }

    res.json({
      success: true,
      data: {
        model
      }
    });
  } catch (error) {
    console.error('Get model error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
