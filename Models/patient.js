const mongoose = require('mongoose');
const { Schema } = mongoose;

const patientSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true
  },
  pid: {
    type: String,
    required: [true, 'Patient ID is required'],
    unique: true,
    match: [/^p[0-9]{3}$/, 'Patient ID must be in format p001, p002, etc.']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function(value) {
        return value < new Date();
      },
      message: 'Date of birth cannot be in the future'
    }
  },
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    required: [true, 'Gender is required']
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: [true, 'Blood type is required']
  },
  emergencyContact: {
    name: {
      type: String,
      required: [true, 'Emergency contact name is required']
    },
    relationship: {
      type: String,
      required: [true, 'Relationship to patient is required']
    },
    phone: {
      type: String,
      required: [true, 'Emergency contact phone is required'],
      match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
    }
  },
  address: {
    street: String,
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required'],
      match: [/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code']
    }
  },
  insurance: {
    provider: String,
    policyNumber: String,
    groupNumber: String
  },
  medicalHistory: {
    allergies: [String],
    chronicConditions: [String],
    medications: [String],
    surgeries: [{
      procedure: String,
      date: Date,
      hospital: String
    }]
  },
  symptomAnalysisHistory: {
    totalAnalyses: {
      type: Number,
      default: 0
    },
    lastAnalysisDate: Date,
    emergencyAnalyses: {
      type: Number,
      default: 0
    },
    highRiskAnalyses: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deceased'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
patientSchema.index({ status: 1 });
patientSchema.index({ bloodType: 1 });
patientSchema.index({ city: 1, state: 1 });

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for display name
patientSchema.virtual('displayName').get(function() {
  const age = this.age;
  return `${this.firstName} ${this.lastName}${age ? ` (${age})` : ''}`;
});

// Pre-save middleware to update user role
patientSchema.pre('save', async function(next) {
  try {
    if (this.isNew) {
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(this.userId, { role: 'patient' });
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to update symptom analysis history
patientSchema.statics.updateSymptomAnalysisHistory = async function(patientId, analysisData) {
  try {
    const patient = await this.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    // Update the symptom analysis history
    patient.symptomAnalysisHistory.totalAnalyses += 1;
    patient.symptomAnalysisHistory.lastAnalysisDate = new Date();

    if (analysisData.isEmergency) {
      patient.symptomAnalysisHistory.emergencyAnalyses += 1;
    }

    if (analysisData.severity === 'high' || analysisData.severity === 'critical') {
      patient.symptomAnalysisHistory.highRiskAnalyses += 1;
    }

    await patient.save();
    return patient;
  } catch (error) {
    throw error;
  }
};

// Instance method to get symptom analysis summary
patientSchema.methods.getSymptomAnalysisSummary = function() {
  return {
    totalAnalyses: this.symptomAnalysisHistory.totalAnalyses,
    lastAnalysisDate: this.symptomAnalysisHistory.lastAnalysisDate,
    emergencyAnalyses: this.symptomAnalysisHistory.emergencyAnalyses,
    highRiskAnalyses: this.symptomAnalysisHistory.highRiskAnalyses,
    riskLevel: this.getRiskLevel()
  };
};

// Instance method to determine risk level
patientSchema.methods.getRiskLevel = function() {
  const { emergencyAnalyses, highRiskAnalyses, totalAnalyses } = this.symptomAnalysisHistory;
  
  if (totalAnalyses === 0) return 'unknown';
  
  const emergencyRate = emergencyAnalyses / totalAnalyses;
  const highRiskRate = highRiskAnalyses / totalAnalyses;
  
  if (emergencyRate > 0.2 || highRiskRate > 0.5) return 'high';
  if (emergencyRate > 0.1 || highRiskRate > 0.3) return 'medium';
  return 'low';
};

const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);
module.exports = Patient;