const mongoose = require('mongoose');
const { Schema } = mongoose;

const appointmentSchema = new Schema({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true,
    enum: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
  },
  reason: {
    type: String,
    required: true
  },
  symptoms: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  notes: {
    type: String
  },
  prescription: {
    type: String
  },
  followUpDate: {
    type: Date
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'insurance-covered'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Index for better query performance
appointmentSchema.index({ patientId: 1, date: 1 });
appointmentSchema.index({ doctorId: 1, date: 1 });
appointmentSchema.index({ status: 1 });

const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
module.exports = Appointment;