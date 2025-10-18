const mongoose = require('mongoose');
const { Schema } = mongoose;

const doctorSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true
  },
  did: {
    type: String,
    required: [true, 'Doctor ID is required'],
    unique: true,
    match: [/^d[0-9]{3}$/, 'Doctor ID must be in format d001, d002, etc.']
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
  specialty: {
    type: String,
    required: [true, 'Specialty is required'],
    enum: [
      'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology',
      'Oncology', 'General Practice', 'Emergency Medicine', 'Internal Medicine',
      'Surgery', 'Psychiatry', 'Radiology', 'Anesthesiology', 'Obstetrics & Gynecology'
    ]
  },
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  licenseNumber: {
    type: String,
    required: [true, 'Medical license number is required'],
    unique: true,
    trim: true
  },
  experience: {
    type: Number,
    min: [0, 'Experience cannot be negative'],
    max: [50, 'Experience cannot exceed 50 years']
  },
  education: {
    degree: {
      type: String,
      required: [true, 'Medical degree is required']
    },
    institution: {
      type: String,
      required: [true, 'Institution name is required']
    },
    graduationYear: {
      type: Number,
      required: [true, 'Graduation year is required'],
      min: [1950, 'Graduation year must be after 1950'],
      max: [new Date().getFullYear(), 'Graduation year cannot be in the future']
    }
  },
  availability: {
    type: String,
    enum: ['Full-time', 'Part-time', 'On-call', 'Consultant'],
    default: 'Full-time'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'pending'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
// Removed duplicate index on licenseNumber because unique: true already creates an index
doctorSchema.index({ specialty: 1 });
doctorSchema.index({ status: 1 });

// Virtual for full name
doctorSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for display name
doctorSchema.virtual('displayName').get(function() {
  return `Dr. ${this.firstName} ${this.lastName} - ${this.specialty}`;
});

// Pre-save middleware to update user role
doctorSchema.pre('save', async function(next) {
  try {
    if (this.isNew) {
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(this.userId, { role: 'doctor' });
    }
    next();
  } catch (error) {
    next(error);
  }
});

const Doctor = mongoose.models.Doctor || mongoose.model('Doctor', doctorSchema);
module.exports = Doctor;