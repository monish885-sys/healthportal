const mongoose = require('mongoose');
const { Schema } = mongoose;

const diseaseCaseSchema = new Schema({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required']
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  symptomAnalysisId: {
    type: Schema.Types.ObjectId,
    ref: 'SymptomAnalysis',
    required: [true, 'Symptom Analysis ID is required']
  },
  diseaseName: {
    type: String,
    required: [true, 'Disease name is required'],
    trim: true,
    index: true
  },
  confidence: {
    type: Number,
    required: [true, 'Confidence score is required'],
    min: [0, 'Confidence must be between 0 and 1'],
    max: [1, 'Confidence must be between 0 and 1']
  },
  symptoms: {
    type: [String],
    required: [true, 'Symptoms are required']
  },
  caseDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  location: {
    type: String,
    default: 'Care and Cure Hospital',
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    index: true
  },
  isEmergency: {
    type: Boolean,
    default: false,
    index: true
  },
  status: {
    type: String,
    enum: ['detected', 'confirmed', 'treated', 'resolved', 'false_positive'],
    default: 'detected',
    index: true
  },
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  doctorNotes: {
    type: String,
    trim: true
  },
  treatment: {
    prescribed: [String],
    medications: [String],
    procedures: [String],
    followUpRequired: {
      type: Boolean,
      default: false
    },
    followUpDate: Date
  },
  outcome: {
    type: String,
    enum: ['recovered', 'improving', 'stable', 'deteriorating', 'unknown'],
    default: 'unknown'
  },
  isOutbreakRelated: {
    type: Boolean,
    default: false,
    index: true
  },
  outbreakId: {
    type: Schema.Types.ObjectId,
    ref: 'DiseaseOutbreak'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
diseaseCaseSchema.index({ diseaseName: 1, caseDate: -1 });
diseaseCaseSchema.index({ location: 1, diseaseName: 1, caseDate: -1 });
diseaseCaseSchema.index({ severity: 1, caseDate: -1 });
diseaseCaseSchema.index({ isEmergency: 1, caseDate: -1 });
diseaseCaseSchema.index({ status: 1, caseDate: -1 });
diseaseCaseSchema.index({ isOutbreakRelated: 1, caseDate: -1 });

// Virtual for formatted case date
diseaseCaseSchema.virtual('formattedDate').get(function() {
  return this.caseDate.toLocaleDateString();
});

// Virtual for confidence percentage
diseaseCaseSchema.virtual('confidencePercentage').get(function() {
  return Math.round(this.confidence * 100);
});

// Virtual for case age in days
diseaseCaseSchema.virtual('caseAgeInDays').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.caseDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Static method to get disease statistics
diseaseCaseSchema.statics.getDiseaseStats = async function(filters = {}) {
  const matchStage = {};
  
  if (filters.diseaseName) matchStage.diseaseName = filters.diseaseName;
  if (filters.location) matchStage.location = filters.location;
  if (filters.severity) matchStage.severity = filters.severity;
  if (filters.status) matchStage.status = filters.status;
  if (filters.startDate || filters.endDate) {
    matchStage.caseDate = {};
    if (filters.startDate) matchStage.caseDate.$gte = new Date(filters.startDate);
    if (filters.endDate) matchStage.caseDate.$lte = new Date(filters.endDate);
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCases: { $sum: 1 },
        emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } },
        criticalCases: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
        highSeverityCases: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
        outbreakRelatedCases: { $sum: { $cond: ['$isOutbreakRelated', 1, 0] } },
        averageConfidence: { $avg: '$confidence' },
        resolvedCases: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        treatedCases: { $sum: { $cond: [{ $eq: ['$status', 'treated'] }, 1, 0] } }
      }
    }
  ]);

  return stats[0] || {
    totalCases: 0,
    emergencyCases: 0,
    criticalCases: 0,
    highSeverityCases: 0,
    outbreakRelatedCases: 0,
    averageConfidence: 0,
    resolvedCases: 0,
    treatedCases: 0
  };
};

// Static method to get disease trends over time
diseaseCaseSchema.statics.getDiseaseTrends = async function(diseaseName, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const trends = await this.aggregate([
    {
      $match: {
        diseaseName: diseaseName,
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
        cases: { $sum: 1 },
        emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } },
        averageConfidence: { $avg: '$confidence' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);

  return trends;
};

// Static method to get top diseases
diseaseCaseSchema.statics.getTopDiseases = async function(limit = 10, filters = {}) {
  const matchStage = {};
  
  if (filters.location) matchStage.location = filters.location;
  if (filters.startDate || filters.endDate) {
    matchStage.caseDate = {};
    if (filters.startDate) matchStage.caseDate.$gte = new Date(filters.startDate);
    if (filters.endDate) matchStage.caseDate.$lte = new Date(filters.endDate);
  }

  const topDiseases = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$diseaseName',
        totalCases: { $sum: 1 },
        emergencyCases: { $sum: { $cond: ['$isEmergency', 1, 0] } },
        criticalCases: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
        averageConfidence: { $avg: '$confidence' },
        lastCaseDate: { $max: '$caseDate' },
        firstCaseDate: { $min: '$caseDate' }
      }
    },
    {
      $sort: { totalCases: -1 }
    },
    {
      $limit: limit
    }
  ]);

  return topDiseases;
};

// Static method to detect potential outbreaks
diseaseCaseSchema.statics.detectPotentialOutbreaks = async function(threshold = 5, timeWindow = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeWindow);

  const potentialOutbreaks = await this.aggregate([
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
        cases: { $push: '$$ROOT' }
      }
    },
    {
      $match: {
        caseCount: { $gte: threshold }
      }
    },
    {
      $sort: { caseCount: -1 }
    }
  ]);

  return potentialOutbreaks;
};

// Static method to get recent cases
diseaseCaseSchema.statics.getRecentCases = async function(limit = 50, filters = {}) {
  const matchStage = {};
  
  if (filters.diseaseName) matchStage.diseaseName = filters.diseaseName;
  if (filters.location) matchStage.location = filters.location;
  if (filters.severity) matchStage.severity = filters.severity;
  if (filters.status) matchStage.status = filters.status;

  return await this.find(matchStage)
    .populate('patientId', 'firstName lastName pid')
    .populate('userId', 'email')
    .populate('doctorId', 'firstName lastName specialty')
    .sort({ caseDate: -1 })
    .limit(limit);
};

const DiseaseCase = mongoose.models.DiseaseCase || mongoose.model('DiseaseCase', diseaseCaseSchema);
module.exports = DiseaseCase;
