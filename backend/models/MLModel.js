const mongoose = require('mongoose');

const mlModelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Model name is required'],
    unique: true,
    trim: true
  },
  
  version: {
    type: String,
    required: [true, 'Model version is required'],
    trim: true
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Model Configuration
  modelType: {
    type: String,
    required: [true, 'Model type is required'],
    enum: ['neural_network', 'random_forest', 'logistic_regression', 'svm', 'ensemble']
  },
  
  // Model Performance Metrics
  performance: {
    accuracy: {
      type: Number,
      min: 0,
      max: 1,
      required: [true, 'Accuracy is required']
    },
    precision: {
      type: Number,
      min: 0,
      max: 1
    },
    recall: {
      type: Number,
      min: 0,
      max: 1
    },
    f1Score: {
      type: Number,
      min: 0,
      max: 1
    },
    auc: {
      type: Number,
      min: 0,
      max: 1
    }
  },
  
  // Training Information
  trainingInfo: {
    trainingDataSize: {
      type: Number,
      required: [true, 'Training data size is required'],
      min: 0
    },
    trainingDate: {
      type: Date,
      required: [true, 'Training date is required']
    },
    trainingDuration: {
      type: Number, // in minutes
      min: 0
    },
    features: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      type: {
        type: String,
        required: true,
        enum: ['numerical', 'categorical', 'text']
      },
      importance: {
        type: Number,
        min: 0,
        max: 1
      }
    }]
  },
  
  // Model Files and Configuration
  modelPath: {
    type: String,
    required: [true, 'Model file path is required'],
    trim: true
  },
  
  configPath: {
    type: String,
    trim: true
  },
  
  // Model Status
  status: {
    type: String,
    enum: ['training', 'ready', 'deployed', 'deprecated', 'error'],
    default: 'training'
  },
  
  isActive: {
    type: Boolean,
    default: false
  },
  
  // Deployment Information
  deployment: {
    deployedAt: Date,
    deployedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development'
    }
  },
  
  // Model Capabilities
  capabilities: {
    supportedSyndromes: [String],
    maxConcurrentPredictions: {
      type: Number,
      default: 1000
    },
    averagePredictionTime: {
      type: Number, // in milliseconds
      default: 0
    }
  },
  
  // Usage Statistics
  usage: {
    totalPredictions: {
      type: Number,
      default: 0
    },
    successfulPredictions: {
      type: Number,
      default: 0
    },
    failedPredictions: {
      type: Number,
      default: 0
    },
    lastUsed: Date
  },
  
  // Model Validation
  validation: {
    crossValidationScore: {
      type: Number,
      min: 0,
      max: 1
    },
    testSetScore: {
      type: Number,
      min: 0,
      max: 1
    },
    validationDate: Date,
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Metadata
  tags: [String],
  notes: String,
  
  // Timestamps
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for success rate
mlModelSchema.virtual('successRate').get(function() {
  if (this.usage.totalPredictions === 0) return 0;
  return this.usage.successfulPredictions / this.usage.totalPredictions;
});

// Virtual for failure rate
mlModelSchema.virtual('failureRate').get(function() {
  if (this.usage.totalPredictions === 0) return 0;
  return this.usage.failedPredictions / this.usage.totalPredictions;
});

// Virtual for model age in days
mlModelSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to update lastUpdated
mlModelSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Static method to find active model
mlModelSchema.statics.findActive = function() {
  return this.findOne({ isActive: true, status: 'deployed' });
};

// Static method to find by name and version
mlModelSchema.statics.findByNameAndVersion = function(name, version) {
  return this.findOne({ name, version });
};

// Instance method to update usage statistics
mlModelSchema.methods.updateUsage = function(success = true) {
  this.usage.totalPredictions += 1;
  if (success) {
    this.usage.successfulPredictions += 1;
  } else {
    this.usage.failedPredictions += 1;
  }
  this.usage.lastUsed = new Date();
  return this.save();
};

// Indexes for better query performance
mlModelSchema.index({ name: 1, version: 1 });
mlModelSchema.index({ status: 1 });
mlModelSchema.index({ isActive: 1 });
mlModelSchema.index({ 'performance.accuracy': -1 });
mlModelSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MLModel', mlModelSchema);
