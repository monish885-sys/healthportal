const mongoose = require('mongoose');

const symptomRecordSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required'],
    index: true
  },
  
  // Symptom Information
  symptoms: [{
    name: {
      type: String,
      required: [true, 'Symptom name is required'],
      trim: true,
      lowercase: true
    },
    severity: {
      type: Number,
      required: [true, 'Symptom severity is required'],
      min: [1, 'Severity must be at least 1'],
      max: [10, 'Severity cannot exceed 10']
    },
    duration: {
      value: {
        type: Number,
        required: [true, 'Duration value is required'],
        min: [0, 'Duration cannot be negative']
      },
      unit: {
        type: String,
        required: [true, 'Duration unit is required'],
        enum: ['minutes', 'hours', 'days', 'weeks']
      }
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    }
  }],
  
  // Vital Signs
  vitalSigns: {
    temperature: {
      value: {
        type: Number,
        min: [90, 'Temperature too low'],
        max: [110, 'Temperature too high']
      },
      unit: {
        type: String,
        enum: ['fahrenheit', 'celsius'],
        default: 'fahrenheit'
      }
    },
    bloodPressure: {
      systolic: {
        type: Number,
        min: [50, 'Systolic pressure too low'],
        max: [250, 'Systolic pressure too high']
      },
      diastolic: {
        type: Number,
        min: [30, 'Diastolic pressure too low'],
        max: [150, 'Diastolic pressure too high']
      }
    },
    heartRate: {
      type: Number,
      min: [30, 'Heart rate too low'],
      max: [220, 'Heart rate too high']
    },
    respiratoryRate: {
      type: Number,
      min: [5, 'Respiratory rate too low'],
      max: [60, 'Respiratory rate too high']
    },
    oxygenSaturation: {
      type: Number,
      min: [70, 'Oxygen saturation too low'],
      max: [100, 'Oxygen saturation too high']
    }
  },
  
  // Additional Information
  additionalInfo: {
    recentTravel: {
      type: Boolean,
      default: false
    },
    travelDetails: {
      destinations: [String],
      returnDate: Date
    },
    recentExposure: {
      type: Boolean,
      default: false
    },
    exposureDetails: String,
    currentMedications: [String],
    recentVaccinations: [{
      vaccine: String,
      date: Date
    }]
  },
  
  // ML Analysis Results
  mlAnalysis: {
    riskScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    predictedSyndrome: {
      type: String,
      trim: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    recommendations: [String],
    flaggedForReview: {
      type: Boolean,
      default: false
    },
    analysisTimestamp: Date
  },
  
  // Record Status
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'analyzed', 'flagged', 'resolved'],
    default: 'submitted'
  },
  
  // Location Information (for syndromic surveillance)
  location: {
    zipCode: String,
    city: String,
    state: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Timestamps
  recordedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total symptom count
symptomRecordSchema.virtual('symptomCount').get(function() {
  return this.symptoms.length;
});

// Virtual for average severity
symptomRecordSchema.virtual('averageSeverity').get(function() {
  if (this.symptoms.length === 0) return 0;
  const totalSeverity = this.symptoms.reduce((sum, symptom) => sum + symptom.severity, 0);
  return totalSeverity / this.symptoms.length;
});

// Virtual for risk level
symptomRecordSchema.virtual('riskLevel').get(function() {
  const score = this.mlAnalysis.riskScore;
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.2) return 'low';
  return 'minimal';
});

// Pre-save middleware to update analysis timestamp
symptomRecordSchema.pre('save', function(next) {
  if (this.mlAnalysis && this.mlAnalysis.riskScore > 0) {
    this.mlAnalysis.analysisTimestamp = new Date();
  }
  next();
});

// Indexes for better query performance
symptomRecordSchema.index({ patientId: 1, recordedAt: -1 });
symptomRecordSchema.index({ 'mlAnalysis.riskScore': -1 });
symptomRecordSchema.index({ 'mlAnalysis.flaggedForReview': 1 });
symptomRecordSchema.index({ 'location.zipCode': 1 });
symptomRecordSchema.index({ recordedAt: -1 });
symptomRecordSchema.index({ status: 1 });

// Compound index for syndromic surveillance queries
symptomRecordSchema.index({ 
  'location.zipCode': 1, 
  recordedAt: -1, 
  'mlAnalysis.riskScore': -1 
});

module.exports = mongoose.model('SymptomRecord', symptomRecordSchema);
