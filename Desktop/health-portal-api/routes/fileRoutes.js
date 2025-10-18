const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FileUpload = require('../Models/FileUpload');
const Feedback = require('../Models/Feedback');
const Patient = require('../Models/patient');
const Doctor = require('../Models/doctor');
const DiseaseCase = require('../Models/DiseaseCase');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow medical documents, images, and PDFs
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream' // For DICOM files
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, images, and documents are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// @route   POST /api/healthcare/upload-file
// @desc    Upload a medical file
// @access  Private
router.post('/upload-file', upload.single('file'), async (req, res) => {
  try {
    const { userId, patientId, fileType, description, tags } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    if (!userId || !patientId || !fileType) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }
    
    // Verify patient exists and belongs to user
    const patient = await Patient.findOne({ 
      _id: patientId, 
      userId: userId 
    });
    
    if (!patient) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ msg: 'Patient not found' });
    }
    
    // Create file upload record
    const fileUpload = new FileUpload({
      userId: userId,
      patientId: patientId,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      fileType: fileType,
      description: description || '',
      uploadedBy: 'patient',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });
    
    await fileUpload.save();
    
    res.json({
      msg: 'File uploaded successfully',
      file: {
        id: fileUpload._id,
        fileName: fileUpload.originalName,
        fileSize: fileUpload.formattedFileSize,
        fileType: fileUpload.fileType,
        uploadedAt: fileUpload.createdAt,
        fileUrl: fileUpload.fileUrl
      }
    });
    
  } catch (error) {
    console.error('File upload error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      msg: 'File upload failed', 
      error: error.message 
    });
  }
});

// @route   GET /api/healthcare/files
// @desc    Get uploaded files for a patient
// @access  Private
router.get('/files', async (req, res) => {
  try {
    const { userId, patientId, fileType, page = 1, limit = 10 } = req.query;
    
    if (!userId || !patientId) {
      return res.status(400).json({ msg: 'User ID and Patient ID are required' });
    }
    
    // Verify patient exists and belongs to user
    const patient = await Patient.findOne({ 
      _id: patientId, 
      userId: userId 
    });
    
    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }
    
    const skip = (page - 1) * limit;
    let query = { patientId: patientId, status: 'active' };
    
    if (fileType && fileType !== 'all') {
      query.fileType = fileType;
    }
    
    const files = await FileUpload.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'email role');
    
    const total = await FileUpload.countDocuments(query);
    
    res.json({
      files: files,
      total: total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   DELETE /api/healthcare/files/:id
// @desc    Delete an uploaded file
// @access  Private
router.delete('/files/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    const fileId = req.params.id;
    
    if (!userId) {
      return res.status(400).json({ msg: 'User ID is required' });
    }
    
    const fileUpload = await FileUpload.findOne({ 
      _id: fileId, 
      userId: userId 
    });
    
    if (!fileUpload) {
      return res.status(404).json({ msg: 'File not found' });
    }
    
    // Delete physical file
    const filePath = path.join(uploadsDir, fileUpload.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Mark as deleted in database
    fileUpload.status = 'deleted';
    await fileUpload.save();
    
    res.json({ msg: 'File deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/healthcare/profile
// @desc    Update patient profile
// @access  Private
router.put('/profile', async (req, res) => {
  try {
    const { userId, patientId, ...updateData } = req.body;
    
    if (!userId || !patientId) {
      return res.status(400).json({ msg: 'User ID and Patient ID are required' });
    }
    
    // Verify patient exists and belongs to user
    const patient = await Patient.findOne({ 
      _id: patientId, 
      userId: userId 
    });
    
    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }
    
    // Validate update data
    const allowedFields = [
      'firstName', 'lastName', 'contactNumber', 'gender', 'bloodType',
      'emergencyContact', 'address', 'insurance', 'medicalHistory'
    ];
    
    const updateFields = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updateFields[key] = updateData[key];
      }
    });
    
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ msg: 'No valid fields to update' });
    }
    
    // Update patient
    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    
    res.json({
      msg: 'Profile updated successfully',
      patient: {
        id: updatedPatient._id,
        firstName: updatedPatient.firstName,
        lastName: updatedPatient.lastName,
        fullName: updatedPatient.fullName,
        contactNumber: updatedPatient.contactNumber,
        gender: updatedPatient.gender,
        bloodType: updatedPatient.bloodType,
        emergencyContact: updatedPatient.emergencyContact,
        address: updatedPatient.address,
        insurance: updatedPatient.insurance,
        medicalHistory: updatedPatient.medicalHistory,
        updatedAt: updatedPatient.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ 
      msg: 'Profile update failed', 
      error: error.message 
    });
  }
});

// @route   POST /api/healthcare/feedback
// @desc    Submit feedback
// @access  Private
router.post('/feedback', async (req, res) => {
  try {
    const { 
      userId, 
      patientId, 
      feedbackType, 
      rating, 
      title, 
      message, 
      category, 
      priority,
      isAnonymous,
      contactPreference 
    } = req.body;
    
    if (!userId || !patientId || !rating || !title || !message || !category) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }
    
    // Verify patient exists and belongs to user
    const patient = await Patient.findOne({ 
      _id: patientId, 
      userId: userId 
    });
    
    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }
    
    // Create feedback
    const feedback = new Feedback({
      userId: userId,
      patientId: patientId,
      feedbackType: feedbackType || 'general',
      rating: parseInt(rating),
      title: title.trim(),
      message: message.trim(),
      category: category,
      priority: priority || 'medium',
      isAnonymous: isAnonymous || false,
      contactPreference: contactPreference || 'email'
    });
    
    await feedback.save();
    
    res.json({
      msg: 'Feedback submitted successfully',
      feedback: {
        id: feedback._id,
        title: feedback.title,
        rating: feedback.rating,
        category: feedback.category,
        status: feedback.status,
        submittedAt: feedback.createdAt
      }
    });
    
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ 
      msg: 'Feedback submission failed', 
      error: error.message 
    });
  }
});

// @route   GET /api/healthcare/feedback
// @desc    Get feedback for a patient
// @access  Private
router.get('/feedback', async (req, res) => {
  try {
    const { userId, patientId, page = 1, limit = 10 } = req.query;
    
    if (!userId || !patientId) {
      return res.status(400).json({ msg: 'User ID and Patient ID are required' });
    }
    
    // Verify patient exists and belongs to user
    const patient = await Patient.findOne({ 
      _id: patientId, 
      userId: userId 
    });
    
    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }
    
    const skip = (page - 1) * limit;
    
    const feedback = await Feedback.find({ 
      patientId: patientId 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedTo', 'firstName lastName email')
      .populate('response.respondedBy', 'firstName lastName email');
    
    const total = await Feedback.countDocuments({ patientId: patientId });
    
    res.json({
      feedback: feedback,
      total: total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/case-details/:id
// @desc    Get detailed case information
// @access  Private
router.get('/case-details/:id', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ msg: 'User ID is required' });
    }
    
    // Get case details with related information
    const diseaseCase = await DiseaseCase.findById(caseId)
      .populate('patientId', 'firstName lastName pid contactNumber address')
      .populate('doctorId', 'firstName lastName specialty contactNumber')
      .populate('symptomAnalysisId', 'symptoms predictedDisease confidence topPredictions analysisDate');
    
    if (!diseaseCase) {
      return res.status(404).json({ msg: 'Case not found' });
    }
    
    // Get related files for this case
    const relatedFiles = diseaseCase.patientId ? await FileUpload.find({
      patientId: diseaseCase.patientId._id,
      status: 'active'
    }).sort({ createdAt: -1 }) : [];
    
    // Get related feedback for this case
    const relatedFeedback = diseaseCase.patientId ? await Feedback.find({
      patientId: diseaseCase.patientId._id,
      feedbackType: { $in: ['symptom_analysis', 'doctor', 'service'] }
    }).sort({ createdAt: -1 }).limit(5) : [];
    
    // Get similar cases for comparison
    const similarCases = await DiseaseCase.find({
      diseaseName: diseaseCase.diseaseName,
      _id: { $ne: caseId },
      status: 'active'
    })
      .populate('patientId', 'firstName lastName pid')
      .populate('doctorId', 'firstName lastName specialty')
      .sort({ caseDate: -1 })
      .limit(5);
    
    res.json({
      case: diseaseCase,
      relatedFiles: relatedFiles,
      relatedFeedback: relatedFeedback,
      similarCases: similarCases,
      caseSummary: {
        totalSimilarCases: await DiseaseCase.countDocuments({ 
          diseaseName: diseaseCase.diseaseName,
          status: 'active'
        }),
        averageConfidence: await DiseaseCase.aggregate([
          { $match: { diseaseName: diseaseCase.diseaseName, status: 'active' } },
          { $group: { _id: null, avgConfidence: { $avg: '$confidence' } } }
        ]).then(result => result[0]?.avgConfidence || 0)
      }
    });
    
  } catch (error) {
    console.error('Error fetching case details:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/feedback-stats
// @desc    Get feedback statistics
// @access  Private
router.get('/feedback-stats', async (req, res) => {
  try {
    const stats = await Feedback.getFeedbackStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
