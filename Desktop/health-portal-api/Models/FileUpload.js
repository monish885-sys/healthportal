const mongoose = require('mongoose');
const { Schema } = mongoose;

// File Upload Model
const fileUploadSchema = new Schema({
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
  fileName: {
    type: String,
    required: [true, 'File name is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Original file name is required'],
    trim: true
  },
  filePath: {
    type: String,
    required: [true, 'File path is required']
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative']
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  fileType: {
    type: String,
    enum: ['medical_report', 'prescription', 'lab_result', 'scan', 'other'],
    required: [true, 'File type is required']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  uploadedBy: {
    type: String,
    enum: ['patient', 'doctor', 'admin'],
    required: [true, 'Uploader role is required']
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  tags: [String],
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
fileUploadSchema.index({ userId: 1 });
fileUploadSchema.index({ patientId: 1 });
fileUploadSchema.index({ fileType: 1 });
fileUploadSchema.index({ status: 1 });
fileUploadSchema.index({ createdAt: -1 });

// Virtual for file URL
fileUploadSchema.virtual('fileUrl').get(function() {
  return `/uploads/${this.filePath}`;
});

// Virtual for formatted file size
fileUploadSchema.virtual('formattedFileSize').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

const FileUpload = mongoose.models.FileUpload || mongoose.model('FileUpload', fileUploadSchema);

module.exports = FileUpload;
