const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../Models/user');
const Doctor = require('../Models/doctor');
const Patient = require('../Models/patient');
const Admin = require('../Models/admin');

// @route   POST /api/auth/login
// @desc    User login with role-based authentication
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    if (!email || !password || !role) {
      return res.status(400).json({ msg: 'Email, password, and role are required' });
    }

    let user = null;
    let profile = null;

    // Find user by email
    user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check if user has the required role
    if (user.role !== role) {
      return res.status(400).json({ msg: `Access denied. This account is registered as ${user.role}` });
    }

    // Get profile based on role
    switch (role) {
      case 'admin':
        // For admin, we can use the user object itself as the profile
        profile = {
          id: user._id,
          email: user.email,
          role: user.role,
          status: user.status
        };
        break;
      
      case 'doctor':
        profile = await Doctor.findOne({ userId: user._id });
        if (!profile) {
          return res.status(400).json({ msg: 'Doctor profile not found' });
        }
        break;
      
      case 'patient':
        profile = await Patient.findOne({ userId: user._id });
        if (!profile) {
          return res.status(400).json({ msg: 'Patient profile not found' });
        }
        break;
      
      default:
        return res.status(400).json({ msg: 'Invalid role specified' });
    }

    // Set session
    req.session.userId = user._id;
    req.session.userRole = user.role;
    req.session.profileId = profile._id;

    // Build profile info safely
    let profileInfo = {
      id: profile._id
    };

    if (role === 'admin') {
      profileInfo.name = profile.email; // Admin doesn't have firstName/lastName
    } else if (role === 'doctor') {
      profileInfo.name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Doctor';
      profileInfo.specialty = profile.specialty;
      profileInfo.did = profile.did;
    } else if (role === 'patient') {
      profileInfo.name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Patient';
      profileInfo.pid = profile.pid;
      profileInfo.bloodType = profile.bloodType;
    }

    // Return success with user info
    res.json({
      msg: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status
      },
      profile: profileInfo
    });

  } catch (err) {
    console.error('Login error:', err.message);
    console.error('Error details:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/auth/logout
// @desc    User logout
// @access  Private
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ msg: 'Error logging out' });
    }
    res.json({ msg: 'Logout successful' });
  });
});

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ msg: 'Not authenticated' });
  }

  res.json({
    userId: req.session.userId,
    role: req.session.userRole,
    profileId: req.session.profileId
  });
});

// @route   POST /api/auth/register
// @desc    User registration (for patients and doctors)
// @access  Public
router.post('/register', async (req, res) => {
  const { email, password, role, firstName, lastName, ...otherFields } = req.body;

  try {
    if (!email || !password || !role || !firstName || !lastName) {
      return res.status(400).json({ msg: 'All required fields must be provided' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      role,
      status: 'active'
    });

    await user.save();

    // Create profile based on role
    let profile = null;
    if (role === 'doctor') {
      const did = `d${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      profile = new Doctor({
        userId: user._id,
        did,
        firstName,
        lastName,
        ...otherFields,
        status: 'pending'
      });
    } else if (role === 'patient') {
      const pid = `p${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      profile = new Patient({
        userId: user._id,
        pid,
        firstName,
        lastName,
        ...otherFields,
        status: 'active'
      });
    }

    if (profile) {
      await profile.save();
    }

    res.status(201).json({
      msg: 'Registration successful',
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
