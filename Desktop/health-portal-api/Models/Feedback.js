const mongoose = require('mongoose');
const { Schema } = mongoose;

// Feedback Model
const feedbackSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required']
  },
  feedbackType: {
    type: String,
    enum: ['general', 'service', 'doctor', 'portal', 'symptom_analysis', 'appointment', 'other'],
    required: [true, 'Feedback type is required'],
    default: 'general'
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating must be at most 5'],
    required: [true, 'Rating is required']
  },
  title: {
    type: String,
    required: [true, 'Feedback title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Feedback message is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  category: {
    type: String,
    enum: ['complaint', 'suggestion', 'compliment', 'bug_report', 'feature_request'],
    required: [true, 'Category is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'resolved', 'closed'],
    default: 'new'
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  response: {
    message: String,
    respondedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  },
  tags: [String],
  isAnonymous: {
    type: Boolean,
    default: false
  },
  contactPreference: {
    type: String,
    enum: ['email', 'phone', 'none'],
    default: 'email'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
feedbackSchema.index({ userId: 1 });
feedbackSchema.index({ patientId: 1 });
feedbackSchema.index({ feedbackType: 1 });
feedbackSchema.index({ category: 1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ priority: 1 });
feedbackSchema.index({ createdAt: -1 });

// Virtual for formatted rating
feedbackSchema.virtual('ratingStars').get(function() {
  return '★'.repeat(this.rating) + '☆'.repeat(5 - this.rating);
});

// Virtual for time since submission
feedbackSchema.virtual('timeSinceSubmission').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
});

// Static method to get feedback statistics
feedbackSchema.statics.getFeedbackStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        byStatus: {
          $push: {
            status: '$status',
            count: 1
          }
        },
        byCategory: {
          $push: {
            category: '$category',
            count: 1
          }
        },
        byRating: {
          $push: {
            rating: '$rating',
            count: 1
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    averageRating: 0,
    byStatus: [],
    byCategory: [],
    byRating: []
  };
};

const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
