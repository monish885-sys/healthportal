const { body, param, query, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Patient registration validation
const validatePatientRegistration = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 0 || age > 120) {
        throw new Error('Please provide a valid date of birth');
      }
      
      return true;
    }),
  
  body('gender')
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Gender must be one of: male, female, other, prefer_not_to_say'),
  
  body('phoneNumber')
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number')
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone number must be between 10 and 15 characters'),
  
  body('address.street')
    .trim()
    .notEmpty()
    .withMessage('Street address is required')
    .isLength({ min: 5, max: 100 })
    .withMessage('Street address must be between 5 and 100 characters'),
  
  body('address.city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  
  body('address.state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),
  
  body('address.zipCode')
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Please provide a valid ZIP code'),
  
  body('address.country')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Country must be between 2 and 50 characters'),
  
  body('emergencyContact.name')
    .trim()
    .notEmpty()
    .withMessage('Emergency contact name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Emergency contact name must be between 2 and 50 characters'),
  
  body('emergencyContact.relationship')
    .trim()
    .notEmpty()
    .withMessage('Emergency contact relationship is required')
    .isLength({ min: 2, max: 30 })
    .withMessage('Emergency contact relationship must be between 2 and 30 characters'),
  
  body('emergencyContact.phoneNumber')
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid emergency contact phone number')
    .isLength({ min: 10, max: 15 })
    .withMessage('Emergency contact phone number must be between 10 and 15 characters'),
  
  body('emergencyContact.email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid emergency contact email address')
    .normalizeEmail()
    .toLowerCase(),
  
  handleValidationErrors
];

// Patient login validation
const validatePatientLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Symptom record validation
const validateSymptomRecord = [
  body('symptoms')
    .isArray({ min: 1 })
    .withMessage('At least one symptom is required'),
  
  body('symptoms.*.name')
    .trim()
    .notEmpty()
    .withMessage('Symptom name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Symptom name must be between 2 and 50 characters'),
  
  body('symptoms.*.severity')
    .isInt({ min: 1, max: 10 })
    .withMessage('Symptom severity must be between 1 and 10'),
  
  body('symptoms.*.duration.value')
    .isFloat({ min: 0 })
    .withMessage('Duration value must be a positive number'),
  
  body('symptoms.*.duration.unit')
    .isIn(['minutes', 'hours', 'days', 'weeks'])
    .withMessage('Duration unit must be one of: minutes, hours, days, weeks'),
  
  body('vitalSigns.temperature.value')
    .optional()
    .isFloat({ min: 90, max: 110 })
    .withMessage('Temperature must be between 90 and 110'),
  
  body('vitalSigns.bloodPressure.systolic')
    .optional()
    .isInt({ min: 50, max: 250 })
    .withMessage('Systolic blood pressure must be between 50 and 250'),
  
  body('vitalSigns.bloodPressure.diastolic')
    .optional()
    .isInt({ min: 30, max: 150 })
    .withMessage('Diastolic blood pressure must be between 30 and 150'),
  
  body('vitalSigns.heartRate')
    .optional()
    .isInt({ min: 30, max: 220 })
    .withMessage('Heart rate must be between 30 and 220'),
  
  body('vitalSigns.respiratoryRate')
    .optional()
    .isInt({ min: 5, max: 60 })
    .withMessage('Respiratory rate must be between 5 and 60'),
  
  body('vitalSigns.oxygenSaturation')
    .optional()
    .isFloat({ min: 70, max: 100 })
    .withMessage('Oxygen saturation must be between 70 and 100'),
  
  body('additionalInfo.recentTravel')
    .optional()
    .isBoolean()
    .withMessage('Recent travel must be a boolean value'),
  
  body('additionalInfo.recentExposure')
    .optional()
    .isBoolean()
    .withMessage('Recent exposure must be a boolean value'),
  
  body('location.zipCode')
    .optional()
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Please provide a valid ZIP code'),
  
  handleValidationErrors
];

// Parameter validation
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  
  handleValidationErrors
];

// Query validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'recordedAt', 'riskScore'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validatePatientRegistration,
  validatePatientLogin,
  validateSymptomRecord,
  validateObjectId,
  validatePagination
};
