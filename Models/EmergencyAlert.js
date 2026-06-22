const mongoose = require('mongoose');
const { Schema } = mongoose;

const emergencyAlertSchema = new Schema({
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
  symptomAnalysisId: {
    type: Schema.Types.ObjectId,
    ref: 'SymptomAnalysis',
    required: true
  },
  diseaseName: {
    type: String,
    required: true,
    trim: true
  },
  severity: {
    type: String,
    enum: ['high', 'critical'],
    required: true
  },
  symptoms: [String],
  message: {
    type: String,
    default: 'High/critical severity symptom analysis requires immediate attention.'
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  acknowledgedAt: Date
}, {
  timestamps: true
});

emergencyAlertSchema.index({ acknowledged: 1, createdAt: -1 });
emergencyAlertSchema.index({ patientId: 1 });
emergencyAlertSchema.index({ createdAt: -1 });

const EmergencyAlert = mongoose.models.EmergencyAlert || mongoose.model('EmergencyAlert', emergencyAlertSchema);
module.exports = EmergencyAlert;
