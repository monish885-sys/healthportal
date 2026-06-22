const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Appointment = require('../Models/appointment');
const MedicalReport = require('../Models/MedicalReport');
const Prescription = require('../Models/prescription');
const Doctor = require('../Models/doctor');
const Patient = require('../Models/patient');
const SymptomAnalysis = require('../Models/SymptomAnalysis');
const DiseaseCase = require('../Models/DiseaseCase');
const DiseaseOutbreak = require('../Models/DiseaseOutbreak');
const EmergencyAlert = require('../Models/EmergencyAlert');
const Feedback = require('../Models/Feedback');
const DISEASE_SPECIALTY_MAP = require('../utils/diseaseSpecialtyMap');
const {
  requireAuth,
  requireUserSession,
  requireRole,
  resolveActor,
  pickAllowedUpdates,
  PATIENT_PROFILE_FIELDS,
  DOCTOR_PROFILE_FIELDS,
} = require('../middleware/auth');
const { uploadReportFile } = require('../middleware/upload');
const {
  analyzeSymptoms,
  getAvailableSymptoms,
  getDiseaseInfo,
  runConsultationBuddy,
} = require('../utils/mlService');

router.use(requireUserSession);

// @route   GET /api/healthcare/appointments
// @desc    Get appointments with filters
// @access  Private
router.get('/appointments', async (req, res) => {
  try {
    const { status, date, page = 1, limit = 10 } = req.query;
    const role = req.session.userRole;
    const userId = req.session.userId;
    const skip = (page - 1) * limit;

    let query = {};
    
    // Filter by role and userId
    if (role === 'doctor') {
      // For doctors, we need to find their profile ID first
      const doctorProfile = await Doctor.findOne({ userId });
      if (doctorProfile) {
        query.doctorId = doctorProfile._id;
      }
    } else if (role === 'patient') {
      // For patients, we need to find their profile ID first
      const patientProfile = await Patient.findOne({ userId });
      if (patientProfile) {
        query.patientId = patientProfile._id;
      }
    }

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by date
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }

    const appointments = await Appointment.find(query)
      .populate('patientId', 'firstName lastName pid')
      .populate('doctorId', 'firstName lastName specialty did')
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    res.json({
      appointments,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/healthcare/appointments
// @desc    Create new appointment
// @access  Private
router.post('/appointments', async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const { patientId, doctorId, date, time, reason, symptoms, notes } = req.body;

    if (!patientId || !doctorId || !date || !time || !reason) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    if (actor.role === 'patient' && patientId !== actor.profileId?.toString()) {
      return res.status(403).json({ msg: 'Patients can only book appointments for themselves' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !['active', 'pending'].includes(doctor.status)) {
      return res.status(400).json({ msg: 'Selected doctor is not available' });
    }

    const patient = await Patient.findById(patientId);
    if (!patient || patient.status !== 'active') {
      return res.status(400).json({ msg: 'Patient not found or inactive' });
    }

    const appointment = new Appointment({
      patientId,
      doctorId,
      date,
      time,
      reason,
      symptoms: symptoms || [],
      notes,
      status: 'scheduled'
    });

    await appointment.save();

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('patientId', 'firstName lastName pid')
      .populate('doctorId', 'firstName lastName specialty did');

    res.status(201).json({
      msg: 'Appointment created successfully',
      appointment: populatedAppointment
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/healthcare/appointments/:id
// @desc    Update appointment
// @access  Private
router.put('/appointments/:id', async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    const isPatientOwner = actor.role === 'patient'
      && appointment.patientId.toString() === actor.profileId?.toString();
    const isDoctorOwner = actor.role === 'doctor'
      && appointment.doctorId.toString() === actor.profileId?.toString();

    if (!isPatientOwner && !isDoctorOwner) {
      return res.status(403).json({ msg: 'Forbidden: cannot update this appointment' });
    }

    const { status, notes, prescription, followUpDate } = req.body;
    const update = {};

    if (actor.role === 'patient') {
      if (status && !['cancelled'].includes(status)) {
        return res.status(403).json({ msg: 'Patients can only cancel appointments' });
      }
      if (status) update.status = status;
    } else if (actor.role === 'doctor') {
      if (status) update.status = status;
      if (notes !== undefined) update.notes = notes;
      if (prescription !== undefined) update.prescription = prescription;
      if (followUpDate !== undefined) update.followUpDate = followUpDate;
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    ).populate('patientId', 'firstName lastName pid')
      .populate('doctorId', 'firstName lastName specialty did');

    res.json({
      msg: 'Appointment updated successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/medical-reports
// @desc    Get medical reports
// @access  Private
router.get('/medical-reports', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const actor = await resolveActor(req);
    const skip = (page - 1) * limit;

    let query = {};

    if (actor.role === 'doctor') {
      query.doctorId = actor.profileId;
    } else if (actor.role === 'patient') {
      query.patientId = actor.profileId;
    } else {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    const reports = await MedicalReport.find(query)
      .populate('patientId', 'firstName lastName pid')
      .populate('doctorId', 'firstName lastName specialty did')
      .populate('appointmentId', 'date time reason')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MedicalReport.countDocuments(query);

    res.json({
      reports,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching medical reports:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/healthcare/medical-reports
// @desc    Create medical report
// @access  Private
router.post('/medical-reports', requireRole('doctor'), async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const {
      patientId, doctorId, appointmentId, diagnosis, symptoms, notes,
      prescription, vitalSigns, labResults, recommendations,
    } = req.body;

    if (!patientId || !diagnosis) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    if (doctorId && doctorId !== actor.profileId?.toString()) {
      return res.status(403).json({ msg: 'Doctors can only create reports for themselves' });
    }

    const report = new MedicalReport({
      patientId,
      doctorId: actor.profileId,
      appointmentId,
      diagnosis,
      symptoms: symptoms || [],
      notes,
      prescription,
      vitalSigns,
      labResults,
      recommendations
    });

    await report.save();

    const populatedReport = await MedicalReport.findById(report._id)
      .populate('patientId', 'firstName lastName pid')
      .populate('doctorId', 'firstName lastName specialty did');

    res.status(201).json({
      msg: 'Medical report created successfully',
      report: populatedReport
    });
  } catch (error) {
    console.error('Error creating medical report:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/healthcare/medical-reports/upload
// @desc    Upload patient medical report
// @access  Private
router.post('/medical-reports/upload', uploadReportFile.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'Report file is required' });
    }

    const patient = await Patient.findOne({ userId: req.session.userId });
    if (!patient) {
      return res.status(404).json({ msg: 'Patient profile not found' });
    }

    const { reportType = 'General Report', notes = '' } = req.body;

    // Keep doctor optional for patient self-uploaded reports.
    const report = new MedicalReport({
      patientId: patient._id,
      date: new Date(),
      reportType,
      diagnosis: `Uploaded report: ${reportType}`,
      notes,
      filePath: `/uploads/reports/${req.file.filename}`,
      fileName: req.file.originalname,
      status: 'pending'
    });

    await report.save();

    res.status(201).json({
      msg: 'Report uploaded successfully',
      report
    });
  } catch (error) {
    console.error('Error uploading medical report:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/doctors
// @desc    List available doctors for booking
// @access  Private
router.get('/doctors', async (req, res) => {
  try {
    const { page = 1, limit = 20, specialty } = req.query;
    const skip = (page - 1) * limit;

    const query = { status: { $in: ['active', 'pending'] } };
    if (specialty) query.specialty = specialty;

    const doctors = await Doctor.find(query)
      .select('did firstName lastName specialty availability status')
      .sort({ firstName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Doctor.countDocuments(query);

    res.json({
      doctors,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/healthcare/prescriptions
// @desc    Create prescription (doctor only)
// @access  Private
router.post('/prescriptions', requireRole('doctor'), async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const {
      patientId, appointmentId, medications, diagnosis, notes, expiresAt,
    } = req.body;

    if (!patientId || !medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({ msg: 'Patient ID and medications are required' });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }

    if (appointmentId) {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json({ msg: 'Appointment not found' });
      }
      if (appointment.doctorId.toString() !== actor.profileId?.toString()) {
        return res.status(403).json({ msg: 'Forbidden: appointment does not belong to this doctor' });
      }
    }

    const prescription = new Prescription({
      patientId,
      doctorId: actor.profileId,
      appointmentId,
      medications,
      diagnosis,
      notes,
      expiresAt,
      status: 'active',
    });

    await prescription.save();

    const populated = await Prescription.findById(prescription._id)
      .populate('patientId', 'firstName lastName pid')
      .populate('doctorId', 'firstName lastName specialty did');

    res.status(201).json({
      msg: 'Prescription created successfully',
      prescription: populated,
    });
  } catch (error) {
    console.error('Error creating prescription:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/prescriptions
// @desc    Get prescriptions
// @access  Private
router.get('/prescriptions', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const actor = await resolveActor(req);
    const skip = (page - 1) * limit;

    let query = {};

    if (actor.role === 'doctor') {
      query.doctorId = actor.profileId;
    } else if (actor.role === 'patient') {
      query.patientId = actor.profileId;
    } else {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    const prescriptions = await Prescription.find(query)
      .populate('patientId', 'firstName lastName pid')
      .populate('doctorId', 'firstName lastName specialty did')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Prescription.countDocuments(query);

    res.json({
      prescriptions,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/dashboard-stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/dashboard-stats', async (req, res) => {
  try {
    const role = req.session.userRole;
    const userId = req.session.userId;

    let query = {};
    if (role === 'doctor') {
      // For doctors, we need to find their profile ID first
      const doctorProfile = await Doctor.findOne({ userId });
      if (doctorProfile) {
        query.doctorId = doctorProfile._id;
      }
    } else if (role === 'patient') {
      // For patients, we need to find their profile ID first
      const patientProfile = await Patient.findOne({ userId });
      if (patientProfile) {
        query.patientId = patientProfile._id;
      }
    }

    // Get appointment counts by status
    const appointmentStats = await Appointment.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = await Appointment.countDocuments({
      ...query,
      date: { $gte: today, $lt: tomorrow }
    });

    // Get upcoming appointments (next 7 days)
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const upcomingAppointments = await Appointment.countDocuments({
      ...query,
      date: { $gte: tomorrow, $lte: nextWeek },
      status: { $in: ['scheduled', 'confirmed'] }
    });

    // Get emergency appointments
    const emergencyAppointments = await Appointment.countDocuments({
      ...query,
      isEmergency: true,
      status: { $in: ['scheduled', 'confirmed'] }
    });

    // Get recent medical reports count
    const recentReports = await MedicalReport.countDocuments({
      ...query,
      date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    // Get active prescriptions count
    const activePrescriptions = await Prescription.countDocuments({
      ...query,
      status: 'active'
    });

    res.json({
      appointmentStats: appointmentStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      todayAppointments,
      upcomingAppointments,
      emergencyAppointments,
      recentReports,
      activePrescriptions
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/profile
// @desc    Get user profile based on role
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const role = req.session.userRole;
    const userId = req.session.userId;

    let profile = null;
    if (role === 'doctor') {
      profile = await Doctor.findOne({ userId }).select('-__v');
    } else if (role === 'patient') {
      profile = await Patient.findOne({ userId }).select('-__v');
    }

    if (!profile) {
      return res.status(404).json({ msg: 'Profile not found' });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/healthcare/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const { updates } = req.body;

    let profile = null;
    if (actor.role === 'doctor') {
      const safeUpdates = pickAllowedUpdates(updates, DOCTOR_PROFILE_FIELDS);
      profile = await Doctor.findOneAndUpdate(
        { userId: actor.userId },
        safeUpdates,
        { new: true, runValidators: true }
      ).select('-__v');
    } else if (actor.role === 'patient') {
      const safeUpdates = pickAllowedUpdates(updates, PATIENT_PROFILE_FIELDS);
      profile = await Patient.findOneAndUpdate(
        { userId: actor.userId },
        safeUpdates,
        { new: true, runValidators: true }
      ).select('-__v');
    } else {
      return res.status(403).json({ msg: 'Only doctors and patients can update profiles' });
    }

    if (!profile) {
      return res.status(404).json({ msg: 'Profile not found' });
    }

    res.json({
      msg: 'Profile updated successfully',
      profile
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/healthcare/symptom-analysis
// @desc    Analyze patient symptoms using ML model
// @access  Private (patient)
router.post('/symptom-analysis', requireRole('patient'), async (req, res) => {
  try {
    const { symptoms } = req.body;
    const userId = req.session.userId;
    const actor = await resolveActor(req);

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ msg: 'Symptoms array is required and cannot be empty' });
    }

    const patient = actor.profile;
    if (!patient) {
      return res.status(404).json({ msg: 'Patient profile not found' });
    }

    const analysisResult = await analyzeSymptoms(symptoms, { enrichPrecautions: true });

    if (!analysisResult.success) {
      return res.status(500).json({
        msg: 'Analysis failed',
        error: analysisResult.error,
      });
    }

    const severity = analysisResult.severity || 'medium';
    const isEmergency = analysisResult.isEmergency === true;
    const hospitalLocation = process.env.HOSPITAL_NAME || 'Care and Cure Hospital';

    const symptomAnalysis = new SymptomAnalysis({
      patientId: patient._id,
      userId,
      symptoms,
      predictedDisease: analysisResult.predictedDisease,
      confidence: analysisResult.confidence,
      topPredictions: analysisResult.topPredictions,
      triggeringSymptoms: analysisResult.triggeringSymptoms || [],
      analysisDate: new Date(analysisResult.analysisDate || Date.now()),
      severity,
      isEmergency,
      recommendations: analysisResult.recommendations || [],
    });

    await symptomAnalysis.save();

    const diseaseCase = new DiseaseCase({
      patientId: patient._id,
      userId,
      symptomAnalysisId: symptomAnalysis._id,
      diseaseName: analysisResult.predictedDisease,
      confidence: analysisResult.confidence,
      symptoms,
      severity: symptomAnalysis.severity,
      isEmergency: symptomAnalysis.isEmergency,
      location: hospitalLocation,
      status: 'detected',
    });

    await diseaseCase.save();

    await Patient.updateSymptomAnalysisHistory(patient._id, {
      isEmergency: symptomAnalysis.isEmergency,
      severity: symptomAnalysis.severity,
    });

    let triageAction = null;
    if (severity === 'high' || severity === 'critical' || isEmergency) {
      await EmergencyAlert.create({
        patientId: patient._id,
        userId,
        symptomAnalysisId: symptomAnalysis._id,
        diseaseName: analysisResult.predictedDisease,
        severity: severity === 'critical' ? 'critical' : 'high',
        symptoms,
        message: `Patient symptom analysis: ${analysisResult.predictedDisease} (${severity}). Requires immediate attention.`,
      });
      triageAction = {
        type: 'emergency_alert',
        message: 'Instant Emergency Alert has been sent to Admin and Doctor dashboards.',
        suggestedAction: 'Admin/Doctor dashboard will show this alert for immediate follow-up.',
      };
    } else if (severity === 'medium') {
      const suggestedSpecialty = DISEASE_SPECIALTY_MAP[analysisResult.predictedDisease] || 'General Practice';
      triageAction = {
        type: 'book_appointment',
        message: `Consider booking an appointment with a ${suggestedSpecialty} specialist.`,
        suggestedSpecialty,
        suggestedAction: 'Open Book Appointment flow and filter by this specialty.',
      };
    } else if (severity === 'low') {
      triageAction = {
        type: 'otc_suggestion',
        message: 'Low severity. Review informational precautions below. This is not medical advice.',
        precautions: analysisResult.precautions || [],
        medicine: analysisResult.medicine || '',
        suggestedAction: 'Consult a healthcare provider if symptoms persist or worsen.',
      };
    }

    res.status(201).json({
      msg: 'Symptom analysis completed successfully',
      disclaimer: 'ML output is informational only and not a clinical diagnosis.',
      analysis: {
        id: symptomAnalysis._id,
        symptoms: symptomAnalysis.symptoms,
        predictedDisease: symptomAnalysis.predictedDisease,
        confidence: symptomAnalysis.confidence,
        confidencePercentage: symptomAnalysis.confidencePercentage,
        topPredictions: symptomAnalysis.topPredictions,
        triggeringSymptoms: symptomAnalysis.triggeringSymptoms || [],
        severity: symptomAnalysis.severity,
        isEmergency: symptomAnalysis.isEmergency,
        analysisDate: symptomAnalysis.analysisDate,
        recommendations: symptomAnalysis.recommendations,
      },
      whyThisPrediction: {
        triggeringSymptoms: symptomAnalysis.triggeringSymptoms || [],
      },
      triageAction,
      diseaseCase: {
        id: diseaseCase._id,
        diseaseName: diseaseCase.diseaseName,
        caseDate: diseaseCase.caseDate,
        location: diseaseCase.location,
        status: diseaseCase.status,
      },
    });
  } catch (error) {
    console.error('Error in symptom analysis:', error);
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
});

// @route   GET /api/healthcare/symptom-analysis
// @desc    Get symptom analysis history for a patient
// @access  Private
router.get('/symptom-analysis', async (req, res) => {
  try {
    const { patientId, page = 1, limit = 10, status } = req.query;
    const userId = req.session.userId;
    const skip = (page - 1) * limit;

    let query = { userId };

    // If patientId is provided, use it; otherwise find patient by userId
    if (patientId) {
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({ msg: 'Patient not found' });
      }
      query.patientId = patientId;
    } else {
      const patient = await Patient.findOne({ userId });
      if (!patient) {
        return res.status(404).json({ msg: 'Patient profile not found' });
      }
      query.patientId = patient._id;
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    const analyses = await SymptomAnalysis.find(query)
      .populate('patientId', 'firstName lastName pid')
      .populate('doctorId', 'firstName lastName specialty did')
      .sort({ analysisDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SymptomAnalysis.countDocuments(query);

    res.json({
      analyses,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error fetching symptom analyses:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/symptom-analysis/:id
// @desc    Get specific symptom analysis by ID
// @access  Private
router.get('/symptom-analysis/:id', async (req, res) => {
  try {
    const userId = req.session.userId;

    const analysis = await SymptomAnalysis.findOne({
      _id: req.params.id,
      userId: userId
    })
    .populate('patientId', 'firstName lastName pid')
    .populate('doctorId', 'firstName lastName specialty did');

    if (!analysis) {
      return res.status(404).json({ msg: 'Symptom analysis not found' });
    }

    res.json({ analysis });

  } catch (error) {
    console.error('Error fetching symptom analysis:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/healthcare/symptom-analysis/:id
// @desc    Update symptom analysis (doctor review)
// @access  Private
router.put('/symptom-analysis/:id', async (req, res) => {
  try {
    const { doctorNotes, status, recommendations, followUpRequired, followUpDate } = req.body;
    const userId = req.session.userId;

    // Check if user is a doctor
    const doctor = await Doctor.findOne({ userId });
    if (!doctor) {
      return res.status(403).json({ msg: 'Only doctors can review symptom analyses' });
    }

    const updateData = {
      doctorId: doctor._id,
      status: status || 'reviewed_by_doctor'
    };

    if (doctorNotes) updateData.doctorNotes = doctorNotes;
    if (recommendations) updateData.recommendations = recommendations;
    if (followUpRequired !== undefined) updateData.followUpRequired = followUpRequired;
    if (followUpDate) updateData.followUpDate = followUpDate;

    const analysis = await SymptomAnalysis.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    .populate('patientId', 'firstName lastName pid')
    .populate('doctorId', 'firstName lastName specialty did');

    if (!analysis) {
      return res.status(404).json({ msg: 'Symptom analysis not found' });
    }

    res.json({
      msg: 'Symptom analysis updated successfully',
      analysis
    });

  } catch (error) {
    console.error('Error updating symptom analysis:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/emergency-alerts
// @desc    List emergency alerts (unacknowledged) for Doctor/Admin dashboard
// @access  Private
router.get('/emergency-alerts', requireRole('doctor'), async (req, res) => {
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
  } catch (error) {
    console.error('Error fetching emergency alerts:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   PUT /api/healthcare/emergency-alerts/:id/acknowledge
// @desc    Acknowledge an emergency alert (Doctor/Admin)
// @access  Private
router.put('/emergency-alerts/:id/acknowledge', requireRole('doctor'), async (req, res) => {
  try {
    const alert = await EmergencyAlert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true, acknowledgedBy: req.session.userId, acknowledgedAt: new Date() },
      { new: true }
    ).populate('patientId', 'firstName lastName pid');
    if (!alert) return res.status(404).json({ msg: 'Alert not found' });
    res.json({ msg: 'Alert acknowledged', alert });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/outbreak-alerts
// @desc    Patient-safe active outbreak notifications
// @access  Private
router.get('/outbreak-alerts', async (req, res) => {
  try {
    const activeOutbreaks = await DiseaseOutbreak.find({ isActive: true })
      .select('diseaseName severity description startDate location')
      .sort({ startDate: -1 })
      .limit(20)
      .lean();

    res.json({
      activeOutbreaks,
      total: activeOutbreaks.length,
    });
  } catch (error) {
    console.error('Error fetching outbreak alerts:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/medical-reports/:id/download
// @desc    Download an uploaded medical report file
// @access  Private
router.get('/medical-reports/:id/download', async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const report = await MedicalReport.findById(req.params.id);

    if (!report || !report.filePath) {
      return res.status(404).json({ msg: 'Report file not found' });
    }

    const isOwner = (actor.role === 'patient' && report.patientId.toString() === actor.profileId?.toString())
      || (actor.role === 'doctor' && report.doctorId && report.doctorId.toString() === actor.profileId?.toString());

    if (!isOwner) {
      return res.status(403).json({ msg: 'Forbidden: cannot access this report' });
    }

    const absolutePath = path.join(__dirname, '..', report.filePath.replace(/^\//, ''));
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ msg: 'File not found on server' });
    }

    return res.download(absolutePath, report.fileName || path.basename(absolutePath));
  } catch (error) {
    console.error('Error downloading medical report:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/available-symptoms
// @desc    Get list of available symptoms from dataset
// @access  Private
router.get('/available-symptoms', async (req, res) => {
  try {
    const symptomsArray = await getAvailableSymptoms();
    res.json({
      symptoms: symptomsArray,
      total: symptomsArray.length,
    });
  } catch (error) {
    console.error('Error fetching available symptoms:', error);
    res.status(500).json({
      msg: 'Server Error',
      error: error.message || 'Failed to load symptoms',
    });
  }
});

// @route   GET /api/healthcare/disease-info/:diseaseName
// @desc    Get information about a specific disease
// @access  Private
router.get('/disease-info/:diseaseName', async (req, res) => {
  try {
    const diseaseName = decodeURIComponent(req.params.diseaseName);
    const diseaseInfo = await getDiseaseInfo(diseaseName);

    if (!diseaseInfo.success) {
      return res.status(404).json({
        msg: 'Disease information not found',
        error: diseaseInfo.error,
      });
    }

    res.json(diseaseInfo);
  } catch (error) {
    console.error('Error fetching disease information:', error);
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
});

// @route   GET /api/healthcare/symptom-analysis-stats
// @desc    Get symptom analysis statistics for a patient
// @access  Private
router.get('/symptom-analysis-stats', async (req, res) => {
  try {
    const { patientId } = req.query;
    const userId = req.session.userId;

    let targetPatientId = patientId;

    // If patientId is not provided, find patient by userId
    if (!targetPatientId) {
      const patient = await Patient.findOne({ userId });
      if (!patient) {
        return res.status(404).json({ msg: 'Patient profile not found' });
      }
      targetPatientId = patient._id;
    }

    const stats = await SymptomAnalysis.getAnalysisStats(targetPatientId);
    const recentAnalyses = await SymptomAnalysis.getRecentAnalyses(targetPatientId, 5);

    res.json({
      stats,
      recentAnalyses
    });

  } catch (error) {
    console.error('Error fetching symptom analysis stats:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/healthcare/feedback
// @desc    Submit patient feedback
// @access  Private
router.post('/feedback', requireRole('patient'), async (req, res) => {
  try {
    const { message, category = 'general', feedbackType = 'suggestion' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ msg: 'Feedback message is required' });
    }

    const patient = await Patient.findOne({ userId: req.session.userId });
    if (!patient) {
      return res.status(404).json({ msg: 'Patient profile not found' });
    }

    const feedback = new Feedback({
      patientId: patient._id,
      userId: req.session.userId,
      message: message.trim(),
      category,
      feedbackType
    });

    await feedback.save();

    res.status(201).json({
      msg: 'Feedback submitted successfully',
      feedback
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0];
      return res.status(400).json({ msg: firstError?.message || 'Invalid feedback input' });
    }
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/healthcare/consultation-buddy
// @desc    Consultation buddy - analyze patient symptoms and get precautions/suggestions
// @access  Private
router.post('/consultation-buddy', requireRole('doctor'), async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const { patientId, symptoms } = req.body;
    const doctorId = actor.profileId?.toString();

    if (!patientId || !symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ msg: 'Patient ID and symptoms array are required' });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }

    const consultationResult = await runConsultationBuddy({
      symptoms,
      patientId,
      doctorId,
    });

    if (!consultationResult.success) {
      return res.status(500).json({
        msg: 'Consultation buddy analysis failed',
        error: consultationResult.error,
        analysis: consultationResult.analysis || null,
      });
    }

    const consultationRecord = new SymptomAnalysis({
      patientId: patient._id,
      doctorId: actor.profileId,
      userId: patient.userId,
      symptoms,
      predictedDisease: consultationResult.analysis.predictedDisease,
      confidence: consultationResult.analysis.confidence,
      topPredictions: consultationResult.analysis.topPredictions,
      analysisDate: new Date(consultationResult.timestamp),
      status: 'analyzed',
      doctorNotes: 'Consultation Buddy Analysis',
      recommendations: [
        consultationResult.precautions.precaution1,
        consultationResult.precautions.precaution2,
        consultationResult.precautions.precaution3,
        consultationResult.precautions.precaution4,
      ].filter((p) => p && p.trim() !== ''),
    });

    await consultationRecord.save();

    res.status(201).json({
      msg: 'Consultation buddy analysis completed successfully',
      disclaimer: 'ML output is informational only and not a clinical diagnosis.',
      consultation: {
        id: consultationRecord._id,
        patient: {
          id: patient._id,
          name: `${patient.firstName} ${patient.lastName}`,
          pid: patient.pid,
        },
        doctor: {
          id: actor.profileId,
          name: `Dr. ${actor.profile.firstName} ${actor.profile.lastName}`,
          specialty: actor.profile.specialty,
        },
        symptoms: consultationResult.symptoms,
        predictedDisease: consultationResult.analysis.predictedDisease,
        confidence: consultationResult.analysis.confidence,
        confidencePercentage: Math.round(consultationResult.analysis.confidence * 100),
        topPredictions: consultationResult.analysis.topPredictions,
        precautions: consultationResult.precautions,
        analysisDate: consultationResult.timestamp,
        recommendations: consultationRecord.recommendations,
      },
    });
  } catch (error) {
    console.error('Error in consultation buddy:', error);
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
});

// @route   GET /api/healthcare/mydoctors/:patientId
// @desc    Get doctors associated with a patient
// @access  Private
router.get('/mydoctors/:patientId', async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const { patientId } = req.params;

    if (actor.role === 'patient' && patientId !== actor.profileId?.toString()) {
      return res.status(403).json({ msg: 'Forbidden: cannot view other patients doctors' });
    }

    const appointments = await Appointment.find({ patientId })
      .populate('doctorId', 'firstName lastName specialty did')
      .sort({ date: -1 });

    const doctorMap = new Map();
    appointments.forEach(apt => {
      if (apt.doctorId) {
        const doctorId = apt.doctorId._id.toString();
        if (!doctorMap.has(doctorId)) {
          doctorMap.set(doctorId, {
            _id: apt.doctorId._id,
            firstName: apt.doctorId.firstName,
            lastName: apt.doctorId.lastName,
            specialty: apt.doctorId.specialty,
            did: apt.doctorId.did,
            relationshipType: 'Appointment',
            firstInteraction: apt.date
          });
        }
      }
    });
    
    const doctors = Array.from(doctorMap.values());

    res.json({
      doctors,
      total: doctors.length,
      page: 1,
      totalPages: 1
    });
  } catch (error) {
    console.error('Error in mydoctors API:', error);
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
});

// @route   GET /api/healthcare/consultation-buddy/patient/:patientId
// @desc    Get patient by ID or PID for consultation buddy
// @access  Private
router.get('/consultation-buddy/patient/:patientId', requireRole('doctor'), async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const { patientId } = req.params;

    let patient = null;
    if (mongoose.Types.ObjectId.isValid(patientId)) {
      patient = await Patient.findById(patientId);
    }

    if (!patient) {
      patient = await Patient.findOne({
        $or: [
          { pid: patientId },
          { pid: patientId.toLowerCase() },
          { pid: patientId.toUpperCase() },
        ],
      });
    }

    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }

    res.json({
      patient: {
        id: patient._id,
        pid: patient.pid,
        firstName: patient.firstName,
        lastName: patient.lastName,
        gender: patient.gender,
        dateOfBirth: patient.dateOfBirth,
        bloodType: patient.bloodType,
        contactNumber: patient.contactNumber,
        address: patient.address,
      },
      doctor: {
        id: actor.profileId,
        name: `Dr. ${actor.profile.firstName} ${actor.profile.lastName}`,
        specialty: actor.profile.specialty,
      },
    });
  } catch (error) {
    console.error('Error fetching patient for consultation buddy:', error);
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
});

// @route   GET /api/healthcare/consultation-buddy/:patientId
// @desc    Get consultation buddy history for a patient
// @access  Private
router.get('/consultation-buddy/:patientId', requireRole('doctor'), async (req, res) => {
  try {
    const actor = await resolveActor(req);
    const { patientId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }

    const consultations = await SymptomAnalysis.find({
      patientId,
      doctorId: actor.profileId,
      doctorNotes: 'Consultation Buddy Analysis',
    })
      .populate('patientId', 'firstName lastName pid')
      .populate('doctorId', 'firstName lastName specialty')
      .sort({ analysisDate: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await SymptomAnalysis.countDocuments({
      patientId,
      doctorId: actor.profileId,
      doctorNotes: 'Consultation Buddy Analysis',
    });

    res.json({
      consultations,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
      patient: {
        id: patient._id,
        name: `${patient.firstName} ${patient.lastName}`,
        pid: patient.pid,
      },
      doctor: {
        id: actor.profileId,
        name: `Dr. ${actor.profile.firstName} ${actor.profile.lastName}`,
        specialty: actor.profile.specialty,
      },
    });
  } catch (error) {
    console.error('Error fetching consultation buddy history:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
