const mongoose = require('mongoose');
const { Schema } = mongoose;

const feedbackSchema = new Schema({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['general', 'service', 'doctor', 'billing', 'technical'],
    default: 'general'
  },
  feedbackType: {
    type: String,
    enum: ['suggestion', 'complaint', 'appreciation', 'bug-report'],
    default: 'suggestion'
  },
  status: {
    type: String,
    enum: ['new', 'in-review', 'resolved'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ patientId: 1, createdAt: -1 });

const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;
