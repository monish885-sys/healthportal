const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../Models/user');
const { requireAdmin } = require('../middleware/auth');
const { sendWelcomeAndResetEmail, isConfigured } = require('../utils/emailService');
const Doctor = require('../Models/doctor');
const Patient = require('../Models/patient');
const Admin = require('../Models/admin');
const Feedback = require('../Models/Feedback');
const EmergencyAlert = require('../Models/EmergencyAlert');

// Generate sequential pid or did
async function generateId(model, prefix) {
  try {
    const count = await model.countDocuments();
    const idNumber = count + 1;
    return `${prefix}${idNumber.toString().padStart(3, '0')}`; // e.g., p001, d001
  } catch (err) {
    throw new Error(`Failed to generate ID: ${err.message}`);
  }
}

// @route   POST /api/admin/login
// @desc    Admin login
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    req.session.adminId = admin._id;
    req.session.userRole = 'admin';
    res.json({ msg: 'Login successful' });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/admin/logout
// @desc    Admin logout
// @access  Admin
router.post('/logout', requireAdmin, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ msg: 'Error logging out' });
    }
    res.json({ msg: 'Logout successful' });
  });
});

// @route   GET /api/admin/stats
// @desc    Get lightweight dashboard stats
// @access  Admin
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [users, doctors, patients] = await Promise.all([
      User.countDocuments(),
      Doctor.countDocuments({ status: { $ne: 'inactive' } }),
      Patient.countDocuments()
    ]);

    res.json({ totalUsers: users, totalDoctors: doctors, totalPatients: patients });
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/admin/emergency-alerts
// @desc    List emergency alerts for Admin dashboard (Instant Emergency Alert)
// @access  Admin
router.get('/emergency-alerts', requireAdmin, async (req, res) => {
  try {
    const { acknowledged = 'false', limit = 50 } = req.query;
    const filter = acknowledged === 'true' ? {} : { acknowledged: false };
    const alerts = await EmergencyAlert.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10) || 50)
      .populate('patientId', 'firstName lastName pid contactNumber')
      .populate('symptomAnalysisId', 'predictedDisease severity symptoms')
      .lean();
    res.json({ alerts, total: alerts.length });
  } catch (err) {
    console.error('Error fetching emergency alerts:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/admin/emergency-alerts/:id/acknowledge
// @desc    Acknowledge an emergency alert
// @access  Admin
router.put('/emergency-alerts/:id/acknowledge', requireAdmin, async (req, res) => {
  try {
    const alert = await EmergencyAlert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true, acknowledgedBy: req.session.adminId || req.session.userId, acknowledgedAt: new Date() },
      { new: true }
    ).populate('patientId', 'firstName lastName pid');
    if (!alert) return res.status(404).json({ msg: 'Alert not found' });
    res.json({ msg: 'Alert acknowledged', alert });
  } catch (err) {
    console.error('Error acknowledging alert:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Helper to paginate
function parsePagination(query) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '10', 10), 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// @route   GET /api/admin/users
// @desc    Get users (paginated)
// @access  Admin
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const [items, total] = await Promise.all([
      User.find({}, 'email role status createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments()
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/admin/doctors
// @desc    Get doctors (paginated)
// @access  Admin
router.get('/doctors', requireAdmin, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const [items, total] = await Promise.all([
      Doctor.find({}, 'firstName lastName specialty contactNumber status userId').populate('userId', 'email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Doctor.countDocuments()
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Error fetching doctors:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/admin/patients
// @desc    Get patients (paginated)
// @access  Admin
router.get('/patients', requireAdmin, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const [items, total] = await Promise.all([
      Patient.find({}, 'firstName lastName dateOfBirth bloodType contactNumber status userId').populate('userId', 'email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Patient.countDocuments()
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Error fetching patients:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/admin/feedback
// @desc    Get patient feedback for admin review
// @access  Admin
router.get('/feedback', requireAdmin, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.feedbackType) filter.feedbackType = req.query.feedbackType;

    const [items, total] = await Promise.all([
      Feedback.find(filter)
        .populate('patientId', 'firstName lastName pid')
        .populate('userId', 'email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Feedback.countDocuments(filter)
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Error fetching feedback:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/admin/feedback/:id/status
// @desc    Update feedback status
// @access  Admin
router.put('/feedback/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'in-review', 'resolved'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid feedback status' });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    )
      .populate('patientId', 'firstName lastName pid')
      .populate('userId', 'email');

    if (!feedback) {
      return res.status(404).json({ msg: 'Feedback not found' });
    }

    res.json({ msg: 'Feedback status updated', feedback });
  } catch (err) {
    console.error('Error updating feedback status:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/admin/create-user
// @desc    Create a new user (and optionally doctor or patient)
// @access  Admin
router.post('/create-user', requireAdmin, async (req, res) => {
  const { 
    email, 
    isDoctor, 
    isPatient, 
    firstName, 
    lastName, 
    specialty, 
    dateOfBirth, 
    contactNumber,
    licenseNumber,
    experience,
    degree,
    institution,
    graduationYear,
    availability,
    gender,
    bloodType,
    emergencyContact,
    address
  } = req.body;

  let user; // ensure visible in catch for cleanup

  try {
    // Validate email
    if (!email) {
      return res.status(400).json({ msg: 'Email is required' });
    }

    // Check if user already exists
    user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Determine role and validate before creating user (support both boolean and string from JSON/form)
    const role = (isDoctor === true || isDoctor === 'true') ? 'doctor' : ((isPatient === true || isPatient === 'true') ? 'patient' : 'user');
    if (role === 'user') {
      return res.status(400).json({ msg: 'Select either Doctor or Patient profile' });
    }

    // Generate temporary password (10 chars, alphanumeric)
    const tempPassword = crypto.randomBytes(6).toString('base64').replace(/[+/=]/g, '').slice(0, 10);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);
    if (!hashedPassword || typeof hashedPassword !== 'string') {
      return res.status(500).json({ msg: 'Failed to generate password' });
    }

    // Reset token for set-password link (7 days)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create new user with password and role (set password explicitly to satisfy required validation)
    user = new User({
      email: email.trim().toLowerCase(),
      role,
      status: 'active',
      resetToken,
      resetTokenExpires
    });
    user.password = hashedPassword;
    await user.save();

    // Create Doctor or Patient if applicable
    let profile = null;
    if (isDoctor === true || isDoctor === 'true') {
      // Validate required doctor fields
      if (!firstName || !lastName || !specialty || !contactNumber || !licenseNumber || !degree || !institution || !graduationYear) {
        await User.deleteOne({ _id: user._id }); // Clean up user if validation fails
        return res.status(400).json({ 
          msg: 'First name, last name, specialty, contact number, license number, degree, institution, and graduation year are required for doctor' 
        });
      }

      const did = await generateId(Doctor, 'd');
      profile = new Doctor({
        userId: user._id,
        did,
        firstName,
        lastName,
        specialty,
        contactNumber,
        licenseNumber,
        experience: experience || 0,
        education: {
          degree,
          institution,
          graduationYear: parseInt(graduationYear)
        },
        availability: availability || 'Full-time',
        status: 'pending'
      });
      await profile.save();

      const emailResult = await sendWelcomeAndResetEmail(user.email, tempPassword, 'doctor', resetToken);
      const payload = {
        msg: emailResult.sent ? 'Doctor created successfully. Welcome email with temporary password and set-password link sent.' : 'Doctor created successfully. Email not sent (SMTP not configured).',
        user: { _id: user._id, email: user.email },
        doctor: { did, firstName, lastName, specialty, status: profile.status }
      };
      if (!isConfigured) payload.tempPassword = tempPassword;
      return res.status(201).json(payload);
    } else if (isPatient === true || isPatient === 'true') {
      // Validate required patient fields
      if (!firstName || !lastName || !dateOfBirth || !contactNumber || !gender || !bloodType || !emergencyContact || !address) {
        await User.deleteOne({ _id: user._id }); // Clean up user if validation fails
        return res.status(400).json({ 
          msg: 'First name, last name, date of birth, contact number, gender, blood type, emergency contact, and address are required for patient' 
        });
      }

      const pid = await generateId(Patient, 'p');
      profile = new Patient({
        userId: user._id,
        pid,
        firstName,
        lastName,
        dateOfBirth,
        contactNumber,
        gender,
        bloodType,
        emergencyContact,
        address,
        status: 'active'
      });
      await profile.save();

      const emailResult = await sendWelcomeAndResetEmail(user.email, tempPassword, 'patient', resetToken);
      const payload = {
        msg: emailResult.sent ? 'Patient created successfully. Welcome email with temporary password and set-password link sent.' : 'Patient created successfully. Email not sent (SMTP not configured).',
        user: { _id: user._id, email: user.email },
        patient: { pid, firstName, lastName, status: profile.status }
      };
      if (!isConfigured) payload.tempPassword = tempPassword;
      return res.status(201).json(payload);
    }

    return res.status(201).json({
      msg: 'User created successfully',
      user: { _id: user._id, email: user.email }
    });
  } catch (err) {
    console.error('Error creating user:', err.message);
    // Clean up user if profile creation fails
    if (user && user._id) {
      try { await User.deleteOne({ _id: user._id }); } catch (_) {}
    }
    return res.status(500).json({ msg: `Server Error: ${err.message}` });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status
// @access  Admin
router.put('/users/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    res.json({ msg: 'User status updated successfully', user });
  } catch (err) {
    console.error('Error updating user status:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/admin/doctors/:id/status
// @desc    Update doctor status
// @access  Admin
router.put('/doctors/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true, runValidators: true }
    );
    
    if (!doctor) {
      return res.status(404).json({ msg: 'Doctor not found' });
    }
    
    res.json({ msg: 'Doctor status updated successfully', doctor });
  } catch (err) {
    console.error('Error updating doctor status:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/admin/patients/:id/status
// @desc    Update patient status
// @access  Admin
router.put('/patients/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const patient = await Patient.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true, runValidators: true }
    );
    
    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }
    
    res.json({ msg: 'Patient status updated successfully', patient });
  } catch (err) {
    console.error('Error updating patient status:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user and associated profile
// @access  Admin
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Delete associated profile first
    if (user.role === 'doctor') {
      await Doctor.findOneAndDelete({ userId: user._id });
    } else if (user.role === 'patient') {
      await Patient.findOneAndDelete({ userId: user._id });
    }

    // Delete user
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ msg: 'User and associated profile deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;