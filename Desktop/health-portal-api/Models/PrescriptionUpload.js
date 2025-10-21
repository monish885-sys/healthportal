const mongoose = require('mongoose');

const PrescriptionUploadSchema = new mongoose.Schema({
  // Basic prescription info
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: true
  },
  
  // Patient and Doctor references
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Appointment reference
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  
  // Upload details
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  
  // Prescription content
  prescriptionType: {
    type: String,
    enum: ['digital', 'handwritten', 'typed'],
    required: true
  },
  
  // OCR Parsing results
  ocrText: {
    type: String,
    default: ''
  },
  parsedData: {
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      duration: String,
      instructions: String
    }],
    doctorNotes: String,
    followUpDate: Date,
    specialInstructions: String
  },
  
  // Parsing status
  parsingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  parsingError: {
    type: String,
    default: ''
  },
  
  // Upload context
  uploadedBy: {
    type: String,
    enum: ['doctor', 'patient'],
    required: true
  },
  uploadContext: {
    type: String,
    enum: ['consultation', 'follow_up', 'emergency', 'routine'],
    default: 'consultation'
  },
  
  // Status and metadata
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  }
}, { timestamps: true });

// Virtual for file URL
PrescriptionUploadSchema.virtual('fileUrl').get(function() {
  return `/uploads/prescriptions/${this.fileName}`;
});

// Virtual for formatted file size
PrescriptionUploadSchema.virtual('formattedFileSize').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for parsing status display
PrescriptionUploadSchema.virtual('parsingStatusDisplay').get(function() {
  const statusMap = {
    'pending': '⏳ Pending',
    'processing': '🔄 Processing',
    'completed': '✅ Completed',
    'failed': '❌ Failed'
  };
  return statusMap[this.parsingStatus] || '❓ Unknown';
});

// Index for efficient queries
PrescriptionUploadSchema.index({ patientId: 1, createdAt: -1 });
PrescriptionUploadSchema.index({ doctorId: 1, createdAt: -1 });
PrescriptionUploadSchema.index({ appointmentId: 1 });
PrescriptionUploadSchema.index({ parsingStatus: 1 });

// Ensure virtuals are included in JSON output
PrescriptionUploadSchema.set('toJSON', { virtuals: true });
PrescriptionUploadSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PrescriptionUpload', PrescriptionUploadSchema);
