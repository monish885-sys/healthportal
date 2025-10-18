const express = require('express');
const router = express.Router();
const DiseaseCase = require('../Models/DiseaseCase');
const DiseaseOutbreak = require('../Models/DiseaseOutbreak');
const SymptomAnalysis = require('../Models/SymptomAnalysis');
const Patient = require('../Models/patient');
const Doctor = require('../Models/doctor');

// @route   GET /api/admin/disease-cases
// @desc    Get all disease cases with filters and pagination
// @access  Admin only
router.get('/disease-cases', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      diseaseName, 
      location, 
      severity, 
      status, 
      isEmergency,
      startDate, 
      endDate,
      sortBy = 'caseDate',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build filter query
    const filter = {};
    if (diseaseName) filter.diseaseName = new RegExp(diseaseName, 'i');
    if (location) filter.location = new RegExp(location, 'i');
    if (severity) filter.severity = severity;
    if (status) filter.status = status;
    if (isEmergency !== undefined) filter.isEmergency = isEmergency === 'true';
    
    if (startDate || endDate) {
      filter.caseDate = {};
      if (startDate) filter.caseDate.$gte = new Date(startDate);
      if (endDate) filter.caseDate.$lte = new Date(endDate);
    }

    const diseaseCases = await DiseaseCase.find(filter)
      .populate('patientId', 'firstName lastName pid contactNumber')
      .populate('userId', 'email')
      .populate('doctorId', 'firstName lastName specialty')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DiseaseCase.countDocuments(filter);

    res.json({
      diseaseCases,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      filters: {
        diseaseName,
        location,
        severity,
        status,
        isEmergency,
        startDate,
        endDate
      }
    });

  } catch (error) {
    console.error('Error fetching disease cases:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/admin/disease-stats
// @desc    Get comprehensive disease statistics
// @access  Admin only
router.get('/disease-stats', async (req, res) => {
  try {
    const { 
      diseaseName, 
      location, 
      startDate, 
      endDate,
      timeRange = '30' // days
    } = req.query;

    const filters = {};
    if (diseaseName) filters.diseaseName = diseaseName;
    if (location) filters.location = location;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    // Get overall statistics
    const overallStats = await DiseaseCase.getDiseaseStats(filters);

    // Get top diseases
    const topDiseases = await DiseaseCase.getTopDiseases(10, filters);

    // Get recent cases
    const recentCases = await DiseaseCase.getRecentCases(20, filters);

    // Get potential outbreaks
    const potentialOutbreaks = await DiseaseCase.detectPotentialOutbreaks(3, parseInt(timeRange));

    // Get disease trends for top diseases
    const diseaseTrends = {};
    for (const disease of topDiseases.slice(0, 5)) {
      diseaseTrends[disease._id] = await DiseaseCase.getDiseaseTrends(disease._id, parseInt(timeRange));
    }

    // Get severity distribution
    const severityDistribution = await DiseaseCase.aggregate([
      { $match: filters },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get status distribution
    const statusDistribution = await DiseaseCase.aggregate([
      { $match: filters },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get daily case counts for the last 30 days
    const dailyCases = await DiseaseCase.aggregate([
      {
        $match: {
          caseDate: {
            $gte: new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$caseDate' },
            month: { $month: '$caseDate' },
            day: { $dayOfMonth: '$caseDate' }
          },
          cases: { $sum: 1 },
          emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.json({
      overallStats,
      topDiseases,
      recentCases,
      potentialOutbreaks,
      diseaseTrends,
      severityDistribution,
      statusDistribution,
      dailyCases,
      timeRange: parseInt(timeRange)
    });

  } catch (error) {
    console.error('Error fetching disease stats:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/admin/outbreak-monitoring
// @desc    Get outbreak monitoring data
// @access  Admin only
router.get('/outbreak-monitoring', async (req, res) => {
  try {
    const { 
      threshold = 3, 
      timeWindow = 7,
      location = 'Care and Cure Hospital'
    } = req.query;

    // Get potential outbreaks
    const potentialOutbreaks = await DiseaseCase.detectPotentialOutbreaks(
      parseInt(threshold), 
      parseInt(timeWindow)
    );

    // Get outbreak risk assessment
    const outbreakRisk = await DiseaseCase.aggregate([
      {
        $match: {
          location: location,
          caseDate: {
            $gte: new Date(Date.now() - parseInt(timeWindow) * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: '$diseaseName',
          caseCount: { $sum: 1 },
          emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } },
          criticalCases: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          averageConfidence: { $avg: '$confidence' },
          firstCaseDate: { $min: '$caseDate' },
          lastCaseDate: { $max: '$caseDate' }
        }
      },
      {
        $addFields: {
          riskLevel: {
            $switch: {
              branches: [
                { case: { $gte: ['$caseCount', 10] }, then: 'critical' },
                { case: { $gte: ['$caseCount', 5] }, then: 'high' },
                { case: { $gte: ['$caseCount', 3] }, then: 'medium' }
              ],
              default: 'low'
            }
          },
          isOutbreak: { $gte: ['$caseCount', parseInt(threshold)] }
        }
      },
      {
        $sort: { caseCount: -1 }
      }
    ]);

    // Get hospital capacity impact
    const capacityImpact = await DiseaseCase.aggregate([
      {
        $match: {
          location: location,
          caseDate: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$caseDate' },
            month: { $month: '$caseDate' },
            day: { $dayOfMonth: '$caseDate' }
          },
          totalCases: { $sum: 1 },
          emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } },
          criticalCases: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.json({
      potentialOutbreaks,
      outbreakRisk,
      capacityImpact,
      monitoringSettings: {
        threshold: parseInt(threshold),
        timeWindow: parseInt(timeWindow),
        location
      },
      alertLevel: potentialOutbreaks.length > 0 ? 'high' : 'normal'
    });

  } catch (error) {
    console.error('Error fetching outbreak monitoring data:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/admin/disease-trends/:diseaseName
// @desc    Get detailed trends for a specific disease
// @access  Admin only
router.get('/disease-trends/:diseaseName', async (req, res) => {
  try {
    const { diseaseName } = req.params;
    const { days = 30, location } = req.query;

    const filters = { diseaseName };
    if (location) filters.location = location;

    // Get disease trends
    const trends = await DiseaseCase.getDiseaseTrends(diseaseName, parseInt(days));

    // Get disease statistics
    const stats = await DiseaseCase.getDiseaseStats(filters);

    // Get recent cases for this disease
    const recentCases = await DiseaseCase.getRecentCases(50, filters);

    // Get severity distribution for this disease
    const severityDistribution = await DiseaseCase.aggregate([
      { $match: filters },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get confidence distribution
    const confidenceDistribution = await DiseaseCase.aggregate([
      { $match: filters },
      {
        $bucket: {
          groupBy: '$confidence',
          boundaries: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            avgConfidence: { $avg: '$confidence' }
          }
        }
      }
    ]);

    res.json({
      diseaseName,
      trends,
      stats,
      recentCases,
      severityDistribution,
      confidenceDistribution,
      timeRange: parseInt(days)
    });

  } catch (error) {
    console.error('Error fetching disease trends:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/admin/disease-case/:id
// @desc    Update disease case status (admin only)
// @access  Admin only
router.put('/disease-case/:id', async (req, res) => {
  try {
    const { status, doctorNotes, treatment, outcome, isOutbreakRelated } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (doctorNotes) updateData.doctorNotes = doctorNotes;
    if (treatment) updateData.treatment = treatment;
    if (outcome) updateData.outcome = outcome;
    if (isOutbreakRelated !== undefined) updateData.isOutbreakRelated = isOutbreakRelated;

    const diseaseCase = await DiseaseCase.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    .populate('patientId', 'firstName lastName pid')
    .populate('userId', 'email')
    .populate('doctorId', 'firstName lastName specialty');

    if (!diseaseCase) {
      return res.status(404).json({ msg: 'Disease case not found' });
    }

    res.json({
      msg: 'Disease case updated successfully',
      diseaseCase
    });

  } catch (error) {
    console.error('Error updating disease case:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/admin/hospital-impact
// @desc    Get hospital impact analysis
// @access  Admin only
router.get('/hospital-impact', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get emergency cases impact
    const emergencyImpact = await DiseaseCase.aggregate([
      {
        $match: {
          isEmergency: true,
          caseDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$caseDate' },
            month: { $month: '$caseDate' },
            day: { $dayOfMonth: '$caseDate' }
          },
          emergencyCases: { $sum: 1 },
          criticalCases: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Get resource utilization by disease
    const resourceUtilization = await DiseaseCase.aggregate([
      {
        $match: {
          caseDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$diseaseName',
          totalCases: { $sum: 1 },
          emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } },
          criticalCases: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          avgConfidence: { $avg: '$confidence' },
          resolvedCases: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }
        }
      },
      {
        $addFields: {
          resourceIntensity: {
            $add: [
              { $multiply: ['$emergencyCases', 3] },
              { $multiply: ['$criticalCases', 5] },
              '$totalCases'
            ]
          }
        }
      },
      {
        $sort: { resourceIntensity: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Get capacity pressure indicators
    const capacityPressure = await DiseaseCase.aggregate([
      {
        $match: {
          caseDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalCases: { $sum: 1 },
          emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } },
          criticalCases: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          unresolvedCases: { $sum: { $cond: [{ $in: ['$status', ['detected', 'confirmed']] }, 1, 0] } }
        }
      }
    ]);

    const pressure = capacityPressure[0] || {};
    const pressureLevel = pressure.emergencyCases > 10 || pressure.criticalCases > 5 ? 'high' : 
                         pressure.emergencyCases > 5 || pressure.criticalCases > 2 ? 'medium' : 'low';

    res.json({
      emergencyImpact,
      resourceUtilization,
      capacityPressure: {
        ...pressure,
        pressureLevel
      },
      recommendations: generateCapacityRecommendations(pressure, pressureLevel),
      timeRange: parseInt(days)
    });

  } catch (error) {
    console.error('Error fetching hospital impact data:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Helper function to generate capacity recommendations
function generateCapacityRecommendations(pressure, pressureLevel) {
  const recommendations = [];

  if (pressureLevel === 'high') {
    recommendations.push('Consider activating emergency protocols');
    recommendations.push('Increase staffing in emergency department');
    recommendations.push('Prepare additional isolation units');
  } else if (pressureLevel === 'medium') {
    recommendations.push('Monitor case trends closely');
    recommendations.push('Ensure adequate staffing levels');
    recommendations.push('Prepare contingency plans');
  } else {
    recommendations.push('Maintain current capacity levels');
    recommendations.push('Continue routine monitoring');
  }

  if (pressure.unresolvedCases > 20) {
    recommendations.push('Prioritize case resolution and follow-up');
  }

  return recommendations;
}

// @route   GET /api/admin/disease/outbreaks
// @desc    Get all disease outbreaks
// @access  Admin only
router.get('/outbreaks', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      severity, 
      isActive,
      diseaseName,
      location,
      sortBy = 'startDate',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build filter query
    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (diseaseName) filter.diseaseName = new RegExp(diseaseName, 'i');
    if (location) filter.location = new RegExp(location, 'i');

    const outbreaks = await DiseaseOutbreak.find(filter)
      .populate('affectedPatients')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DiseaseOutbreak.countDocuments(filter);

    res.json({
      outbreaks,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      filters: {
        status,
        severity,
        isActive,
        diseaseName,
        location
      }
    });

  } catch (error) {
    console.error('Error fetching outbreaks:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/admin/disease/outbreaks/detect
// @desc    Manually trigger outbreak detection
// @access  Admin only
router.post('/outbreaks/detect', async (req, res) => {
  try {
    const { threshold = 3, timeWindow = 7 } = req.body;

    const newOutbreaks = await DiseaseOutbreak.detectNewOutbreaks(
      parseInt(threshold),
      parseInt(timeWindow)
    );

    res.json({
      msg: 'Outbreak detection completed',
      newOutbreaks,
      count: newOutbreaks.length,
      settings: {
        threshold: parseInt(threshold),
        timeWindow: parseInt(timeWindow)
      }
    });

  } catch (error) {
    console.error('Error detecting outbreaks:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/admin/disease/outbreaks/manual
// @desc    Manually declare an outbreak for a specific disease
// @access  Admin only
router.post('/outbreaks/manual', async (req, res) => {
  try {
    const { 
      diseaseName, 
      severity = 'medium', 
      description = '', 
      threshold = 1,
      timeWindow = 1 
    } = req.body;

    if (!diseaseName) {
      return res.status(400).json({ msg: 'Disease name is required' });
    }

    // Check if outbreak already exists for this disease
    const existingOutbreak = await DiseaseOutbreak.findOne({
      diseaseName: diseaseName,
      location: 'Care and Cure Hospital',
      isActive: true
    });

    if (existingOutbreak) {
      return res.status(400).json({ 
        msg: `Active outbreak already exists for ${diseaseName}` 
      });
    }

    // Create manual outbreak
    const manualOutbreak = new DiseaseOutbreak({
      diseaseName: diseaseName,
      location: 'Care and Cure Hospital',
      startDate: new Date(),
      status: 'confirmed',
      severity: severity,
      totalCases: 0,
      threshold: parseInt(threshold),
      timeWindow: parseInt(timeWindow),
      description: description || `Manually declared outbreak for ${diseaseName}`,
      actions: [{
        action: 'Manual Declaration',
        description: `Administrator manually declared ${diseaseName} as an active outbreak`,
        takenBy: null, // In real app, this would be the admin user ID
        takenAt: new Date(),
        status: 'completed'
      }],
      isActive: true
    });

    await manualOutbreak.save();

    // Update existing cases of this disease to be outbreak-related
    const updatedCases = await DiseaseCase.updateMany(
      { 
        diseaseName: diseaseName,
        location: 'Care and Cure Hospital',
        isOutbreakRelated: false
      },
      { 
        $set: { 
          isOutbreakRelated: true,
          outbreakId: manualOutbreak._id
        }
      }
    );

    // Update outbreak with affected cases
    const affectedCases = await DiseaseCase.find({
      diseaseName: diseaseName,
      outbreakId: manualOutbreak._id
    });

    manualOutbreak.totalCases = affectedCases.length;
    manualOutbreak.emergencyCases = affectedCases.filter(c => c.isEmergency).length;
    manualOutbreak.criticalCases = affectedCases.filter(c => c.severity === 'critical').length;
    manualOutbreak.affectedPatients = affectedCases.map(c => c._id);
    
    if (affectedCases.length > 0) {
      manualOutbreak.averageConfidence = affectedCases.reduce((sum, c) => sum + c.confidence, 0) / affectedCases.length;
    }

    await manualOutbreak.save();

    res.json({
      msg: `Outbreak manually declared for ${diseaseName}`,
      outbreak: manualOutbreak,
      updatedCases: updatedCases.modifiedCount,
      affectedCases: affectedCases.length
    });

  } catch (error) {
    console.error('Error creating manual outbreak:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/admin/disease/available-diseases
// @desc    Get list of all diseases that have been detected
// @access  Admin only
router.get('/available-diseases', async (req, res) => {
  try {
    const diseases = await DiseaseCase.aggregate([
      {
        $group: {
          _id: '$diseaseName',
          totalCases: { $sum: 1 },
          lastCaseDate: { $max: '$caseDate' },
          averageConfidence: { $avg: '$confidence' },
          emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } }
        }
      },
      {
        $sort: { totalCases: -1 }
      }
    ]);

    res.json({
      diseases: diseases.map(d => ({
        name: d._id,
        totalCases: d.totalCases,
        lastCaseDate: d.lastCaseDate,
        averageConfidence: Math.round(d.averageConfidence * 100),
        emergencyCases: d.emergencyCases
      }))
    });

  } catch (error) {
    console.error('Error fetching available diseases:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/admin/disease/outbreaks/stats
// @desc    Get outbreak statistics
// @access  Admin only
router.get('/outbreaks/stats', async (req, res) => {
  try {
    const stats = await DiseaseOutbreak.getOutbreakStats();
    const activeOutbreaks = await DiseaseOutbreak.getActiveOutbreaks();

    res.json({
      stats,
      activeOutbreaks,
      summary: {
        totalOutbreaks: stats.totalOutbreaks,
        activeOutbreaks: stats.activeOutbreaks,
        resolvedOutbreaks: stats.resolvedOutbreaks,
        criticalOutbreaks: stats.criticalOutbreaks,
        totalCases: stats.totalCases,
        totalEmergencyCases: stats.totalEmergencyCases
      }
    });

  } catch (error) {
    console.error('Error fetching outbreak stats:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/admin/disease/outbreaks/:id
// @desc    Update outbreak status and information
// @access  Admin only
router.put('/outbreaks/:id', async (req, res) => {
  try {
    const { 
      status, 
      severity, 
      description, 
      actions, 
      recommendations,
      isActive 
    } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (severity) updateData.severity = severity;
    if (description) updateData.description = description;
    if (actions) updateData.actions = actions;
    if (recommendations) updateData.recommendations = recommendations;
    if (isActive !== undefined) updateData.isActive = isActive;

    const outbreak = await DiseaseOutbreak.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    .populate('affectedPatients')
    .populate('actions.takenBy', 'firstName lastName email');

    if (!outbreak) {
      return res.status(404).json({ msg: 'Outbreak not found' });
    }

    res.json({
      msg: 'Outbreak updated successfully',
      outbreak
    });

  } catch (error) {
    console.error('Error updating outbreak:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/admin/disease/outbreaks/:id/actions
// @desc    Add action to an outbreak
// @access  Admin only
router.post('/outbreaks/:id/actions', async (req, res) => {
  try {
    const { action, description, takenBy } = req.body;

    if (!action) {
      return res.status(400).json({ msg: 'Action is required' });
    }

    const outbreak = await DiseaseOutbreak.findById(req.params.id);
    if (!outbreak) {
      return res.status(404).json({ msg: 'Outbreak not found' });
    }

    await outbreak.addAction(action, description, takenBy);

    const updatedOutbreak = await DiseaseOutbreak.findById(req.params.id)
      .populate('actions.takenBy', 'firstName lastName email');

    res.json({
      msg: 'Action added successfully',
      outbreak: updatedOutbreak
    });

  } catch (error) {
    console.error('Error adding outbreak action:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/admin/disease/outbreaks/:id/update-stats
// @desc    Manually update outbreak statistics
// @access  Admin only
router.post('/outbreaks/:id/update-stats', async (req, res) => {
  try {
    const outbreak = await DiseaseOutbreak.findById(req.params.id);
    if (!outbreak) {
      return res.status(404).json({ msg: 'Outbreak not found' });
    }

    await outbreak.updateStatistics();

    const updatedOutbreak = await DiseaseOutbreak.findById(req.params.id)
      .populate('affectedPatients');

    res.json({
      msg: 'Outbreak statistics updated successfully',
      outbreak: updatedOutbreak
    });

  } catch (error) {
    console.error('Error updating outbreak statistics:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
