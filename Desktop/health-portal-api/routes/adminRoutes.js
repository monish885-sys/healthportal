const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../Models/user');
const Doctor = require('../Models/doctor');
const Patient = require('../Models/patient');
const Admin = require('../Models/admin');

// Middleware to protect admin routes
const requireAdmin = (req, res, next) => {
  if (!req.session.adminId) {
    return res.status(401).json({ msg: 'Unauthorized: Admin login required' });
  }
  next();
};

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

    // Create new user
    user = new User({ email });
    await user.save();

    // Create Doctor or Patient if applicable
    let profile = null;
    if (isDoctor === 'true') {
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
      
      return res.status(201).json({
        msg: 'Doctor created successfully',
        user: { _id: user._id, email: user.email },
        doctor: { 
          did, 
          firstName, 
          lastName, 
          specialty,
          status: profile.status 
        }
      });
    } else if (isPatient === 'true') {
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
      
      return res.status(201).json({
        msg: 'Patient created successfully',
        user: { _id: user._id, email: user.email },
        patient: { 
          pid, 
          firstName, 
          lastName,
          status: profile.status 
        }
      });
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