const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  role: {
    type: String,
    enum: ['user', 'doctor', 'patient', 'admin'],
    default: 'user'
  },
  lastLogin: {
    type: Date,
    default: null
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
// Removed duplicate index on email because unique: true already creates an index
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });

// Virtual for full name (if available)
userSchema.virtual('fullName').get(function() {
  return this.firstName && this.lastName ? `${this.firstName} ${this.lastName}` : this.email;
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = User;