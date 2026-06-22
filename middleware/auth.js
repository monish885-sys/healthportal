const Doctor = require('../Models/doctor');
const Patient = require('../Models/patient');

function isAdminSession(req) {
  return Boolean(req.session?.adminId) || req.session?.userRole === 'admin';
}

function requireAuth(req, res, next) {
  if (!req.session?.userId && !req.session?.adminId) {
    return res.status(401).json({ msg: 'Unauthorized: login required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!isAdminSession(req)) {
    return res.status(401).json({ msg: 'Unauthorized: admin login required' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ msg: 'Unauthorized: login required' });
    }
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ msg: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}

async function resolveActor(req) {
  const role = req.session.userRole;
  const userId = req.session.userId;

  if (role === 'doctor') {
    const doctor = await Doctor.findOne({ userId });
    return {
      role,
      userId,
      profileId: doctor?._id,
      profile: doctor,
    };
  }

  if (role === 'patient') {
    const patient = await Patient.findOne({ userId });
    return {
      role,
      userId,
      profileId: patient?._id,
      profile: patient,
    };
  }

  return { role, userId, profileId: req.session.profileId, profile: null };
}

const PATIENT_PROFILE_FIELDS = [
  'firstName', 'lastName', 'contactNumber', 'gender', 'bloodType',
  'emergencyContact', 'address', 'insurance', 'medicalHistory',
];

const DOCTOR_PROFILE_FIELDS = [
  'firstName', 'lastName', 'contactNumber', 'specialty', 'availability',
];

function pickAllowedUpdates(updates, allowedFields) {
  if (!updates || typeof updates !== 'object') return {};
  return allowedFields.reduce((acc, field) => {
    if (updates[field] !== undefined) acc[field] = updates[field];
    return acc;
  }, {});
}

function requireUserSession(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ msg: 'Unauthorized: login required' });
  }
  next();
}

module.exports = {
  isAdminSession,
  requireAuth,
  requireUserSession,
  requireAdmin,
  requireRole,
  resolveActor,
  pickAllowedUpdates,
  PATIENT_PROFILE_FIELDS,
  DOCTOR_PROFILE_FIELDS,
};
