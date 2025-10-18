const mongoose = require('mongoose');
const { Schema } = mongoose;

const symptomAnalysisSchema = new Schema({
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
  symptoms: {
    type: [String],
    required: [true, 'Symptoms are required'],
    validate: {
      validator: function(symptoms) {
        return symptoms.length > 0;
      },
      message: 'At least one symptom must be provided'
    }
  },
  predictedDisease: {
    type: String,
    required: [true, 'Predicted disease is required']
  },
  confidence: {
    type: Number,
    required: [true, 'Confidence score is required'],
    min: [0, 'Confidence must be between 0 and 1'],
    max: [1, 'Confidence must be between 0 and 1']
  },
  topPredictions: [{
    disease: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    }
  }],
  analysisDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'analyzed', 'reviewed_by_doctor'],
    default: 'analyzed'
  },
  doctorNotes: {
    type: String,
    trim: true
  },
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  recommendations: [{
    type: String,
    trim: true
  }],
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
symptomAnalysisSchema.index({ patientId: 1, analysisDate: -1 });
symptomAnalysisSchema.index({ userId: 1, analysisDate: -1 });
symptomAnalysisSchema.index({ predictedDisease: 1 });
symptomAnalysisSchema.index({ status: 1 });
symptomAnalysisSchema.index({ isEmergency: 1 });
symptomAnalysisSchema.index({ severity: 1 });

// Virtual for formatted analysis date
symptomAnalysisSchema.virtual('formattedDate').get(function() {
  return this.analysisDate.toLocaleDateString();
});

// Virtual for confidence percentage
symptomAnalysisSchema.virtual('confidencePercentage').get(function() {
  return Math.round(this.confidence * 100);
});

// Pre-save middleware to set severity based on confidence and disease
symptomAnalysisSchema.pre('save', function(next) {
  // Set severity based on confidence and disease type
  if (this.confidence < 0.3) {
    this.severity = 'low';
  } else if (this.confidence < 0.7) {
    this.severity = 'medium';
  } else if (this.confidence < 0.9) {
    this.severity = 'high';
  } else {
    this.severity = 'critical';
  }

  // Set emergency flag for critical diseases
  const criticalDiseases = [
    'heart attack', 'stroke', 'severe allergic reaction', 
    'pneumonia', 'meningitis', 'sepsis'
  ];
  
  if (criticalDiseases.some(disease => 
    this.predictedDisease.toLowerCase().includes(disease.toLowerCase())
  )) {
    this.isEmergency = true;
    this.severity = 'critical';
  }

  next();
});

// Static method to get analysis statistics
symptomAnalysisSchema.statics.getAnalysisStats = async function(patientId) {
  const stats = await this.aggregate([
    { $match: { patientId: mongoose.Types.ObjectId(patientId) } },
    {
      $group: {
        _id: null,
        totalAnalyses: { $sum: 1 },
        averageConfidence: { $avg: '$confidence' },
        emergencyCount: { $sum: { $cond: ['$isEmergency', 1, 0] } },
        highSeverityCount: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
        criticalSeverityCount: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
      }
    }
  ]);

  return stats[0] || {
    totalAnalyses: 0,
    averageConfidence: 0,
    emergencyCount: 0,
    highSeverityCount: 0,
    criticalSeverityCount: 0
  };
};

// Static method to get recent analyses
symptomAnalysisSchema.statics.getRecentAnalyses = function(patientId, limit = 5) {
  return this.find({ patientId })
    .sort({ analysisDate: -1 })
    .limit(limit)
    .select('symptoms predictedDisease confidence severity isEmergency analysisDate');
};

const SymptomAnalysis = mongoose.models.SymptomAnalysis || mongoose.model('SymptomAnalysis', symptomAnalysisSchema);
module.exports = SymptomAnalysis;
