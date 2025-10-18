// models/MedicalReport.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const medicalReportSchema = new Schema({
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
  appointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  date: {
    type: Date,
    default: Date.now
  },
  diagnosis: {
    type: String,
    required: true
  },
  symptoms: [{
    type: String
  }],
  notes: {
    type: String
  },
  prescription: {
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      duration: String,
      instructions: String
    }],
    notes: String
  },
  vitalSigns: {
    bloodPressure: String,
    heartRate: String,
    temperature: String,
    weight: String,
    height: String
  },
  labResults: [{
    testName: String,
    result: String,
    normalRange: String,
    date: Date
  }],
  recommendations: [{
    type: String
  }],
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  isUrgent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for better query performance
medicalReportSchema.index({ patientId: 1, date: -1 });
medicalReportSchema.index({ doctorId: 1, date: -1 });

const MedicalReport = mongoose.models.MedicalReport || mongoose.model('MedicalReport', medicalReportSchema);
module.exports = MedicalReport;
