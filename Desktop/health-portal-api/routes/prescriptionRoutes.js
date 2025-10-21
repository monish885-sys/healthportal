const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PrescriptionUpload = require('../Models/PrescriptionUpload');
const Prescription = require('../Models/prescription');
const PrescriptionParsingAgent = require('../services/PrescriptionParsingAgent');

const router = express.Router();
const parsingAgent = new PrescriptionParsingAgent();

// Configure multer for prescription uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/prescriptions');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'prescription-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, images, and text files are allowed for prescriptions.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// @route   POST /api/healthcare/upload-prescription
// @desc    Upload prescription file (doctor or patient)
// @access  Private
router.post('/upload-prescription', upload.single('prescription'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No prescription file uploaded' });
    }

    const { patientId, appointmentId, prescriptionType, uploadContext, doctorNotes } = req.body;
    const uploadedBy = req.session.userRole; // 'doctor' or 'patient'

    if (!patientId) {
      return res.status(400).json({ msg: 'Patient ID is required' });
    }

    // Create prescription record first
    const prescription = new Prescription({
      patientId: patientId,
      doctorId: uploadedBy === 'doctor' ? req.session.userId : null,
      medications: [],
      instructions: doctorNotes || '',
      status: 'active',
      createdAt: new Date()
    });

    await prescription.save();

    // Create prescription upload record
    const prescriptionUpload = new PrescriptionUpload({
      prescriptionId: prescription._id,
      patientId: patientId,
      doctorId: uploadedBy === 'doctor' ? req.session.userId : null,
      userId: req.session.userId,
      appointmentId: appointmentId || null,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      prescriptionType: prescriptionType || 'handwritten',
      uploadedBy: uploadedBy,
      uploadContext: uploadContext || 'consultation',
      parsingStatus: 'processing'
    });

    await prescriptionUpload.save();

    // Start OCR parsing in background
    parsingAgent.parsePrescription(req.file.path, req.file.mimetype)
      .then(async (result) => {
        try {
          if (result.success) {
            // Update prescription upload with parsed data
            prescriptionUpload.ocrText = result.ocrText;
            prescriptionUpload.parsedData = result.parsedData;
            prescriptionUpload.parsingStatus = 'completed';

            // Update prescription record with parsed medications
            if (result.parsedData && result.parsedData.medications) {
              prescription.medications = result.parsedData.medications.map(med => ({
                name: med.name,
                dosage: med.dosage,
                frequency: med.frequency,
                duration: med.duration,
                instructions: med.instructions
              }));
              prescription.instructions = result.parsedData.specialInstructions || prescription.instructions;
            }

            await prescriptionUpload.save();
            await prescription.save();

            console.log(`✅ Prescription parsed successfully for upload: ${prescriptionUpload._id}`);
          } else {
            prescriptionUpload.parsingStatus = 'failed';
            prescriptionUpload.parsingError = result.error;
            await prescriptionUpload.save();
            console.log(`❌ Prescription parsing failed: ${result.error}`);
          }
        } catch (error) {
          console.error('Error updating prescription after parsing:', error);
        }
      })
      .catch(error => {
        console.error('Error in prescription parsing:', error);
        prescriptionUpload.parsingStatus = 'failed';
        prescriptionUpload.parsingError = error.message;
        prescriptionUpload.save();
      });

    res.json({
      msg: 'Prescription uploaded successfully',
      prescriptionUpload: {
        id: prescriptionUpload._id,
        fileName: prescriptionUpload.fileName,
        originalName: prescriptionUpload.originalName,
        fileSize: prescriptionUpload.formattedFileSize,
        prescriptionType: prescriptionUpload.prescriptionType,
        uploadedBy: prescriptionUpload.uploadedBy,
        parsingStatus: prescriptionUpload.parsingStatus,
        createdAt: prescriptionUpload.createdAt
      },
      prescription: {
        id: prescription._id,
        status: prescription.status
      }
    });

  } catch (error) {
    console.error('Error uploading prescription:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/prescriptions/:patientId
// @desc    Get all prescriptions for a patient
// @access  Private
router.get('/prescriptions/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { uploadedBy, limit = 20, offset = 0 } = req.query;

    let query = { patientId: patientId, status: 'active' };
    if (uploadedBy) {
      query.uploadedBy = uploadedBy;
    }

    const prescriptions = await PrescriptionUpload.find(query)
      .populate('doctorId', 'firstName lastName specialty')
      .populate('appointmentId', 'appointmentDate appointmentTime')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await PrescriptionUpload.countDocuments(query);

    res.json({
      prescriptions: prescriptions,
      total: total,
      hasMore: (parseInt(offset) + prescriptions.length) < total
    });

  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/prescription/:id
// @desc    Get specific prescription details
// @access  Private
router.get('/prescription/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const prescriptionUpload = await PrescriptionUpload.findById(id)
      .populate('patientId', 'firstName lastName')
      .populate('doctorId', 'firstName lastName specialty')
      .populate('appointmentId', 'appointmentDate appointmentTime reason')
      .populate('prescriptionId');

    if (!prescriptionUpload) {
      return res.status(404).json({ msg: 'Prescription not found' });
    }

    res.json({
      prescription: prescriptionUpload
    });

  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/healthcare/prescription/:id/verify
// @desc    Verify prescription (doctor only)
// @access  Private
router.post('/prescription/:id/verify', async (req, res) => {
  try {
    if (req.session.userRole !== 'doctor') {
      return res.status(403).json({ msg: 'Only doctors can verify prescriptions' });
    }

    const { id } = req.params;
    const { isVerified, notes } = req.body;

    const prescriptionUpload = await PrescriptionUpload.findById(id);
    if (!prescriptionUpload) {
      return res.status(404).json({ msg: 'Prescription not found' });
    }

    prescriptionUpload.isVerified = isVerified;
    prescriptionUpload.verifiedBy = req.session.userId;
    prescriptionUpload.verifiedAt = new Date();

    if (notes) {
      prescriptionUpload.parsedData.doctorNotes = notes;
    }

    await prescriptionUpload.save();

    res.json({
      msg: 'Prescription verification updated',
      prescription: prescriptionUpload
    });

  } catch (error) {
    console.error('Error verifying prescription:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   DELETE /api/healthcare/prescription/:id
// @desc    Delete prescription upload
// @access  Private
router.delete('/prescription/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const prescriptionUpload = await PrescriptionUpload.findById(id);
    if (!prescriptionUpload) {
      return res.status(404).json({ msg: 'Prescription not found' });
    }

    // Check permissions
    if (req.session.userRole !== 'admin' && 
        prescriptionUpload.userId.toString() !== req.session.userId) {
      return res.status(403).json({ msg: 'Not authorized to delete this prescription' });
    }

    // Delete file from filesystem
    if (fs.existsSync(prescriptionUpload.filePath)) {
      fs.unlinkSync(prescriptionUpload.filePath);
    }

    // Soft delete the record
    prescriptionUpload.status = 'deleted';
    await prescriptionUpload.save();

    res.json({ msg: 'Prescription deleted successfully' });

  } catch (error) {
    console.error('Error deleting prescription:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/prescription-stats/:patientId
// @desc    Get prescription statistics for a patient
// @access  Private
router.get('/prescription-stats/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    const stats = await PrescriptionUpload.aggregate([
      { $match: { patientId: mongoose.Types.ObjectId(patientId), status: 'active' } },
      {
        $group: {
          _id: null,
          totalPrescriptions: { $sum: 1 },
          doctorUploads: { $sum: { $cond: [{ $eq: ['$uploadedBy', 'doctor'] }, 1, 0] } },
          patientUploads: { $sum: { $cond: [{ $eq: ['$uploadedBy', 'patient'] }, 1, 0] } },
          verifiedPrescriptions: { $sum: { $cond: ['$isVerified', 1, 0] } },
          parsedPrescriptions: { $sum: { $cond: [{ $eq: ['$parsingStatus', 'completed'] }, 1, 0] } }
        }
      }
    ]);

    const result = stats[0] || {
      totalPrescriptions: 0,
      doctorUploads: 0,
      patientUploads: 0,
      verifiedPrescriptions: 0,
      parsedPrescriptions: 0
    };

    res.json({ stats: result });

  } catch (error) {
    console.error('Error fetching prescription stats:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
