const mongoose = require('mongoose');
const { Schema } = mongoose;

const diseaseOutbreakSchema = new Schema({
  diseaseName: {
    type: String,
    required: [true, 'Disease name is required'],
    trim: true,
    index: true
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    default: 'Care and Cure Hospital',
    index: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    index: true
  },
  endDate: {
    type: Date,
    index: true
  },
  status: {
    type: String,
    enum: ['detected', 'confirmed', 'contained', 'resolved', 'false_alarm'],
    default: 'detected',
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    index: true
  },
  totalCases: {
    type: Number,
    default: 0
  },
  emergencyCases: {
    type: Number,
    default: 0
  },
  criticalCases: {
    type: Number,
    default: 0
  },
  resolvedCases: {
    type: Number,
    default: 0
  },
  averageConfidence: {
    type: Number,
    min: 0,
    max: 1
  },
  threshold: {
    type: Number,
    required: true,
    default: 3
  },
  timeWindow: {
    type: Number,
    required: true,
    default: 7
  },
  description: {
    type: String,
    trim: true
  },
  actions: [{
    action: {
      type: String,
      required: true
    },
    description: String,
    takenBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    takenAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    }
  }],
  recommendations: [{
    type: String,
    trim: true
  }],
  affectedPatients: [{
    type: Schema.Types.ObjectId,
    ref: 'DiseaseCase'
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
diseaseOutbreakSchema.index({ diseaseName: 1, location: 1, startDate: -1 });
diseaseOutbreakSchema.index({ status: 1, severity: 1 });
diseaseOutbreakSchema.index({ isActive: 1, startDate: -1 });

// Virtual for outbreak duration in days
diseaseOutbreakSchema.virtual('durationInDays').get(function() {
  if (!this.endDate) {
    const now = new Date();
    const diffTime = Math.abs(now - this.startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  const diffTime = Math.abs(this.endDate - this.startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for case resolution rate
diseaseOutbreakSchema.virtual('resolutionRate').get(function() {
  if (this.totalCases === 0) return 0;
  return (this.resolvedCases / this.totalCases) * 100;
});

// Virtual for emergency case rate
diseaseOutbreakSchema.virtual('emergencyRate').get(function() {
  if (this.totalCases === 0) return 0;
  return (this.emergencyCases / this.totalCases) * 100;
});

// Static method to detect new outbreaks
diseaseOutbreakSchema.statics.detectNewOutbreaks = async function(threshold = 3, timeWindow = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeWindow);

  // Get potential outbreaks from disease cases
  const DiseaseCase = mongoose.model('DiseaseCase');
  const potentialOutbreaks = await DiseaseCase.aggregate([
    {
      $match: {
        caseDate: { $gte: startDate },
        status: { $in: ['detected', 'confirmed'] }
      }
    },
    {
      $group: {
        _id: {
          diseaseName: '$diseaseName',
          location: '$location'
        },
        caseCount: { $sum: 1 },
        emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } },
        criticalCases: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
        averageConfidence: { $avg: '$confidence' },
        firstCaseDate: { $min: '$caseDate' },
        lastCaseDate: { $max: '$caseDate' },
        caseIds: { $push: '$_id' }
      }
    },
    {
      $match: {
        caseCount: { $gte: threshold }
      }
    }
  ]);

  const newOutbreaks = [];

  for (const outbreak of potentialOutbreaks) {
    // Check if outbreak already exists
    const existingOutbreak = await this.findOne({
      diseaseName: outbreak._id.diseaseName,
      location: outbreak._id.location,
      isActive: true
    });

    if (!existingOutbreak) {
      // Determine severity based on case count and emergency cases
      let severity = 'low';
      if (outbreak.caseCount >= 20 || outbreak.emergencyCases >= 5) {
        severity = 'critical';
      } else if (outbreak.caseCount >= 10 || outbreak.emergencyCases >= 3) {
        severity = 'high';
      } else if (outbreak.caseCount >= 5) {
        severity = 'medium';
      }

      const newOutbreak = new this({
        diseaseName: outbreak._id.diseaseName,
        location: outbreak._id.location,
        startDate: outbreak.firstCaseDate,
        totalCases: outbreak.caseCount,
        emergencyCases: outbreak.emergencyCases,
        criticalCases: outbreak.criticalCases,
        averageConfidence: outbreak.averageConfidence,
        threshold: threshold,
        timeWindow: timeWindow,
        severity: severity,
        affectedPatients: outbreak.caseIds,
        description: `Outbreak detected: ${outbreak.caseCount} cases of ${outbreak._id.diseaseName} in ${outbreak._id.location} within ${timeWindow} days`
      });

      await newOutbreak.save();
      newOutbreaks.push(newOutbreak);
    }
  }

  return newOutbreaks;
};

// Static method to get active outbreaks
diseaseOutbreakSchema.statics.getActiveOutbreaks = async function() {
  return await this.find({ isActive: true })
    .populate('affectedPatients')
    .sort({ startDate: -1 });
};

// Static method to get outbreak statistics
diseaseOutbreakSchema.statics.getOutbreakStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalOutbreaks: { $sum: 1 },
        activeOutbreaks: { $sum: { $cond: ['$isActive', 1, 0] } },
        resolvedOutbreaks: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        criticalOutbreaks: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
        totalCases: { $sum: '$totalCases' },
        totalEmergencyCases: { $sum: '$emergencyCases' }
      }
    }
  ]);

  return stats[0] || {
    totalOutbreaks: 0,
    activeOutbreaks: 0,
    resolvedOutbreaks: 0,
    criticalOutbreaks: 0,
    totalCases: 0,
    totalEmergencyCases: 0
  };
};

// Instance method to update outbreak statistics
diseaseOutbreakSchema.methods.updateStatistics = async function() {
  const DiseaseCase = mongoose.model('DiseaseCase');
  
  const stats = await DiseaseCase.aggregate([
    {
      $match: {
        _id: { $in: this.affectedPatients },
        diseaseName: this.diseaseName,
        location: this.location
      }
    },
    {
      $group: {
        _id: null,
        totalCases: { $sum: 1 },
        emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } },
        criticalCases: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
        resolvedCases: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        averageConfidence: { $avg: '$confidence' }
      }
    }
  ]);

  if (stats.length > 0) {
    const stat = stats[0];
    this.totalCases = stat.totalCases;
    this.emergencyCases = stat.emergencyCases;
    this.criticalCases = stat.criticalCases;
    this.resolvedCases = stat.resolvedCases;
    this.averageConfidence = stat.averageConfidence;
    this.lastUpdated = new Date();
    
    await this.save();
  }
};

// Instance method to add action
diseaseOutbreakSchema.methods.addAction = async function(action, description, takenBy) {
  this.actions.push({
    action,
    description,
    takenBy,
    takenAt: new Date()
  });
  
  await this.save();
};

// Pre-save middleware to update lastUpdated
diseaseOutbreakSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const DiseaseOutbreak = mongoose.models.DiseaseOutbreak || mongoose.model('DiseaseOutbreak', diseaseOutbreakSchema);
module.exports = DiseaseOutbreak;
