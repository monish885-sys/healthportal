const mongoose = require('mongoose');
const { Schema } = mongoose;

const adminSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  }
});

const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
module.exports = Admin;