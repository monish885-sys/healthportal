const mongoose = require('mongoose');
const { Schema } = mongoose;

const prescriptionSchema = new Schema({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor',
    required: false
  },
  appointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  date: {
    type: Date,
    default: Date.now
  },
  medications: [{
    name: {
      type: String,
      required: true
    },
    dosage: {
      type: String,
      required: true
    },
    frequency: {
      type: String,
      required: true
    },
    duration: {
      type: String,
      required: true
    },
    instructions: String,
    quantity: String,
    refills: {
      type: Number,
      default: 0
    }
  }],
  diagnosis: String,
  notes: String,
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'discontinued'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for better query performance
prescriptionSchema.index({ patientId: 1, date: -1 });
prescriptionSchema.index({ doctorId: 1, date: -1 });
prescriptionSchema.index({ status: 1 });

const Prescription = mongoose.models.Prescription || mongoose.model('Prescription', prescriptionSchema);
module.exports = Prescription;
