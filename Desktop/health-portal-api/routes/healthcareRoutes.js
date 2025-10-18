const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Appointment = require('../Models/appointment');
const MedicalReport = require('../Models/MedicalReport');
const Prescription = require('../Models/prescription');
const Doctor = require('../Models/doctor');
const Patient = require('../Models/patient');
const SymptomAnalysis = require('../Models/SymptomAnalysis');
const DiseaseCase = require('../Models/DiseaseCase');
const { spawn } = require('child_process');
const path = require('path');

// @route   GET /api/healthcare/appointments
// @desc    Get appointments with filters
// @access  Private
router.get('/appointments', async (req, res) => {
  try {
    const { role, userId, status, date, page = 1, limit = 10 } = req.query;
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
    const { patientId, doctorId, date, time, reason, symptoms, notes } = req.body;

    if (!patientId || !doctorId || !date || !time || !reason) {
      return res.status(400).json({ msg: 'Missing required fields' });
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
    const { status, notes, prescription, followUpDate } = req.body;

    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      {
        status,
        notes,
        prescription,
        followUpDate
      },
      { new: true }
    ).populate('patientId', 'firstName lastName pid')
     .populate('doctorId', 'firstName lastName specialty did');

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    res.json({
      msg: 'Appointment updated successfully',
      appointment
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
    const { role, userId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (role === 'doctor') {
      query.doctorId = userId;
    } else if (role === 'patient') {
      query.patientId = userId;
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
router.post('/medical-reports', async (req, res) => {
  try {
    const { patientId, doctorId, appointmentId, diagnosis, symptoms, notes, prescription, vitalSigns, labResults, recommendations } = req.body;

    if (!patientId || !doctorId || !diagnosis) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }

    const report = new MedicalReport({
      patientId,
      doctorId,
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

// @route   GET /api/healthcare/prescriptions
// @desc    Get prescriptions
// @access  Private
router.get('/prescriptions', async (req, res) => {
  try {
    const { role, userId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (role === 'doctor') {
      query.doctorId = userId;
    } else if (role === 'patient') {
      query.patientId = userId;
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
    const { role, userId } = req.query;

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
    const { role, userId } = req.query;

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
    const { role, userId, updates } = req.body;

    let profile = null;
    if (role === 'doctor') {
      profile = await Doctor.findOneAndUpdate(
        { userId },
        updates,
        { new: true, runValidators: true }
      ).select('-__v');
    } else if (role === 'patient') {
      profile = await Patient.findOneAndUpdate(
        { userId },
        updates,
        { new: true, runValidators: true }
      ).select('-__v');
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

// Helper function to run Python script
const runPythonScript = (scriptPath, args = []) => {
  return new Promise((resolve, reject) => {
    const python = spawn('./venv/bin/python3', [scriptPath, ...args]);
    let dataString = '';
    let errorString = '';

    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${errorString}`));
      } else {
        try {
          // Extract JSON from the output (handle cases where there might be other text)
          const lines = dataString.trim().split('\n');
          let jsonLine = '';
          
          // Find the line that contains JSON (starts with [ or {)
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
              jsonLine = trimmed;
              break;
            }
          }
          
          if (!jsonLine) {
            throw new Error('No JSON found in output');
          }
          
          const result = JSON.parse(jsonLine);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}. Data: ${dataString}`));
        }
      }
    });
  });
};

// @route   POST /api/healthcare/symptom-analysis
// @desc    Analyze patient symptoms using ML model
// @access  Private
router.post('/symptom-analysis', async (req, res) => {
  try {
    const { symptoms, userId, patientId } = req.body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ msg: 'Symptoms array is required and cannot be empty' });
    }

    if (!userId) {
      return res.status(400).json({ msg: 'User ID is required' });
    }

    // Get patient profile if patientId is provided
    let patient = null;
    if (patientId) {
      patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({ msg: 'Patient not found' });
      }
    } else {
      // Find patient by userId
      patient = await Patient.findOne({ userId });
      if (!patient) {
        return res.status(404).json({ msg: 'Patient profile not found' });
      }
    }

    // Create a temporary Python script to run the analysis
    const tempScript = `
import sys
import json
sys.path.append('${path.join(__dirname, '..')}')
from symptom_analyzer import analyze_symptoms_api

symptoms = ${JSON.stringify(symptoms)}
result = analyze_symptoms_api(symptoms)
print(json.dumps(result))
`;

    const tempScriptPath = path.join(__dirname, '..', 'temp_analysis.py');
    require('fs').writeFileSync(tempScriptPath, tempScript);

    try {
      // Run the analysis
      const analysisResult = await runPythonScript(tempScriptPath);

      if (!analysisResult.success) {
        return res.status(500).json({ 
          msg: 'Analysis failed', 
          error: analysisResult.error 
        });
      }

      // Save the analysis to database
      const symptomAnalysis = new SymptomAnalysis({
        patientId: patient._id,
        userId: userId,
        symptoms: symptoms,
        predictedDisease: analysisResult.predictedDisease,
        confidence: analysisResult.confidence,
        topPredictions: analysisResult.topPredictions,
        analysisDate: new Date(analysisResult.analysisDate)
      });

      await symptomAnalysis.save();

      // Create a disease case record
      const diseaseCase = new DiseaseCase({
        patientId: patient._id,
        userId: userId,
        symptomAnalysisId: symptomAnalysis._id,
        diseaseName: analysisResult.predictedDisease,
        confidence: analysisResult.confidence,
        symptoms: symptoms,
        severity: symptomAnalysis.severity,
        isEmergency: symptomAnalysis.isEmergency,
        location: 'Care and Cure Hospital',
        status: 'detected'
      });

      await diseaseCase.save();

      // Update patient's symptom analysis history
      await Patient.updateSymptomAnalysisHistory(patient._id, {
        isEmergency: symptomAnalysis.isEmergency,
        severity: symptomAnalysis.severity
      });

      // Clean up temp file
      require('fs').unlinkSync(tempScriptPath);

      res.status(201).json({
        msg: 'Symptom analysis completed successfully',
        analysis: {
          id: symptomAnalysis._id,
          symptoms: symptomAnalysis.symptoms,
          predictedDisease: symptomAnalysis.predictedDisease,
          confidence: symptomAnalysis.confidence,
          confidencePercentage: symptomAnalysis.confidencePercentage,
          topPredictions: symptomAnalysis.topPredictions,
          severity: symptomAnalysis.severity,
          isEmergency: symptomAnalysis.isEmergency,
          analysisDate: symptomAnalysis.analysisDate,
          recommendations: symptomAnalysis.recommendations
        },
        diseaseCase: {
          id: diseaseCase._id,
          diseaseName: diseaseCase.diseaseName,
          caseDate: diseaseCase.caseDate,
          location: diseaseCase.location,
          status: diseaseCase.status
        }
      });

    } catch (error) {
      // Clean up temp file
      if (require('fs').existsSync(tempScriptPath)) {
        require('fs').unlinkSync(tempScriptPath);
      }
      throw error;
    }

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
    const { userId, patientId, page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    if (!userId) {
      return res.status(400).json({ msg: 'User ID is required' });
    }

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
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ msg: 'User ID is required' });
    }

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
    const { userId, doctorNotes, status, recommendations, followUpRequired, followUpDate } = req.body;

    if (!userId) {
      return res.status(400).json({ msg: 'User ID is required' });
    }

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

// @route   GET /api/healthcare/available-symptoms
// @desc    Get list of available symptoms from dataset
// @access  Private
router.get('/available-symptoms', async (req, res) => {
  try {
    // Create a temporary Python script to get symptoms
    const tempScript = `
import sys
import json
sys.path.append('${path.join(__dirname, '..')}')
from symptom_analyzer import get_symptoms_api

symptoms = get_symptoms_api()
print(json.dumps(symptoms))
`;

    const tempScriptPath = path.join(__dirname, '..', 'temp_symptoms.py');
    require('fs').writeFileSync(tempScriptPath, tempScript);

    try {
      const symptoms = await runPythonScript(tempScriptPath);
      
      // Clean up temp file
      require('fs').unlinkSync(tempScriptPath);

      // Ensure symptoms is an array
      const symptomsArray = Array.isArray(symptoms) ? symptoms : [];
      
      res.json({
        symptoms: symptomsArray,
        total: symptomsArray.length
      });

    } catch (error) {
      // Clean up temp file
      if (require('fs').existsSync(tempScriptPath)) {
        require('fs').unlinkSync(tempScriptPath);
      }
      throw error;
    }

  } catch (error) {
    console.error('Error fetching available symptoms:', error);
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
});

// @route   GET /api/healthcare/disease-info/:diseaseName
// @desc    Get information about a specific disease
// @access  Private
router.get('/disease-info/:diseaseName', async (req, res) => {
  try {
    const diseaseName = decodeURIComponent(req.params.diseaseName);

    // Create a temporary Python script to get disease info
    const tempScript = `
import sys
import json
sys.path.append('${path.join(__dirname, '..')}')
from symptom_analyzer import get_disease_info_api

disease_name = "${diseaseName}"
result = get_disease_info_api(disease_name)
print(json.dumps(result))
`;

    const tempScriptPath = path.join(__dirname, '..', 'temp_disease_info.py');
    require('fs').writeFileSync(tempScriptPath, tempScript);

    try {
      const diseaseInfo = await runPythonScript(tempScriptPath);
      
      // Clean up temp file
      require('fs').unlinkSync(tempScriptPath);

      if (!diseaseInfo.success) {
        return res.status(404).json({ 
          msg: 'Disease information not found', 
          error: diseaseInfo.error 
        });
      }

      res.json(diseaseInfo);

    } catch (error) {
      // Clean up temp file
      if (require('fs').existsSync(tempScriptPath)) {
        require('fs').unlinkSync(tempScriptPath);
      }
      throw error;
    }

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
    const { userId, patientId } = req.query;

    if (!userId) {
      return res.status(400).json({ msg: 'User ID is required' });
    }

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

// @route   POST /api/healthcare/consultation-buddy
// @desc    Consultation buddy - analyze patient symptoms and get precautions/suggestions
// @access  Private
router.post('/consultation-buddy', async (req, res) => {
  try {
    const { patientId, symptoms, doctorId } = req.body;

    if (!patientId || !symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ msg: 'Patient ID and symptoms array are required' });
    }

    if (!doctorId) {
      return res.status(400).json({ msg: 'Doctor ID is required' });
    }

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }

    // Verify doctor exists (skip for test doctor)
    let doctor = null;
    if (doctorId !== 'test') {
      doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({ msg: 'Doctor not found' });
      }
    }

    // Create a temporary Python script to run the analysis
    const tempScript = `
import sys
import json
import pandas as pd
sys.path.append('${path.join(__dirname, '..')}')
from symptom_analyzer import analyze_symptoms_api

# Analyze symptoms using ML model
symptoms = ${JSON.stringify(symptoms)}
analysis_result = analyze_symptoms_api(symptoms)

# Load precautions and medicine data from dp.csv
try:
    dp_df = pd.read_csv('${path.join(__dirname, '..', 'dataset', 'dp.csv')}')
    
    # Find matching disease in precautions dataset
    predicted_disease = analysis_result.get('predictedDisease', '')
    disease_info = None
    
    if predicted_disease:
        # Try to find exact match first
        disease_match = dp_df[dp_df['Disease'].str.lower() == predicted_disease.lower()]
        
        if disease_match.empty:
            # Try partial match
            disease_match = dp_df[dp_df['Disease'].str.contains(predicted_disease, case=False, na=False)]
        
        if not disease_match.empty:
            disease_info = disease_match.iloc[0].to_dict()
    
    # Prepare response
    response = {
        'success': True,
        'patientId': '${patientId}',
        'doctorId': '${doctorId}',
        'symptoms': symptoms,
        'analysis': analysis_result,
        'precautions': {
            'disease': predicted_disease,
            'precaution1': disease_info.get('Precaution_1', '') if disease_info else '',
            'precaution2': disease_info.get('Precaution_2', '') if disease_info else '',
            'precaution3': disease_info.get('Precaution_3', '') if disease_info else '',
            'precaution4': disease_info.get('Precaution_4', '') if disease_info else '',
            'medicine': disease_info.get('Medicine', '') if disease_info else ''
        },
        'timestamp': pd.Timestamp.now().isoformat()
    }
    
    print(json.dumps(response))
    
except Exception as e:
    error_response = {
        'success': False,
        'error': f'Error loading precautions data: {str(e)}',
        'analysis': analysis_result
    }
    print(json.dumps(error_response))
`;

    const tempScriptPath = path.join(__dirname, '..', 'temp_consultation_buddy.py');
    require('fs').writeFileSync(tempScriptPath, tempScript);

    try {
      // Run the consultation buddy analysis
      const consultationResult = await runPythonScript(tempScriptPath);

      if (!consultationResult.success) {
        return res.status(500).json({ 
          msg: 'Consultation buddy analysis failed', 
          error: consultationResult.error,
          analysis: consultationResult.analysis || null
        });
      }

      // Save the consultation to database
      const consultationRecord = new SymptomAnalysis({
        patientId: patient._id,
        doctorId: doctor ? doctor._id : null,
        userId: patient.userId,
        symptoms: symptoms,
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
          consultationResult.precautions.precaution4
        ].filter(p => p && p.trim() !== '')
      });

      await consultationRecord.save();

      // Clean up temp file
      require('fs').unlinkSync(tempScriptPath);

      res.status(201).json({
        msg: 'Consultation buddy analysis completed successfully',
        consultation: {
          id: consultationRecord._id,
          patient: {
            id: patient._id,
            name: `${patient.firstName} ${patient.lastName}`,
            pid: patient.pid
          },
          doctor: doctor ? {
            id: doctor._id,
            name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
            specialty: doctor.specialty
          } : {
            id: 'test',
            name: 'Test Doctor',
            specialty: 'General Practice'
          },
          symptoms: consultationResult.symptoms,
          predictedDisease: consultationResult.analysis.predictedDisease,
          confidence: consultationResult.analysis.confidence,
          confidencePercentage: Math.round(consultationResult.analysis.confidence * 100),
          topPredictions: consultationResult.analysis.topPredictions,
          precautions: consultationResult.precautions,
          analysisDate: consultationResult.timestamp,
          recommendations: consultationRecord.recommendations
        }
      });

    } catch (error) {
      // Clean up temp file
      if (require('fs').existsSync(tempScriptPath)) {
        require('fs').unlinkSync(tempScriptPath);
      }
      throw error;
    }

  } catch (error) {
    console.error('Error in consultation buddy:', error);
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
});

// @route   GET /api/healthcare/mydoctors/:patientId
// @desc    Get doctors associated with a patient
// @access  Private
router.get('/mydoctors/:patientId', async (req, res) => {
  console.log('=== MYDOCTORS API CALLED ===');
  console.log('Patient ID:', req.params.patientId);
  
  try {
    const { patientId } = req.params;
    
    // Get doctors from appointments first
    const appointments = await Appointment.find({ patientId })
      .populate('doctorId', 'firstName lastName specialty did')
      .sort({ date: -1 });
    
    console.log('Found appointments with doctors:', appointments.length);
    
    // Extract unique doctors
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
    console.log('Returning doctors:', doctors.length);
    
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
router.get('/consultation-buddy/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctorId } = req.query;

    console.log('Patient lookup request:', { patientId, doctorId });

    if (!doctorId) {
      return res.status(400).json({ msg: 'Doctor ID is required' });
    }

    // For testing purposes, skip doctor verification if doctorId is 'test'
    let doctor = null;
    if (doctorId !== 'test') {
      doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({ msg: 'Doctor not found' });
      }
    }

    // Check if patientId is a valid ObjectId
    let patient = null;
    if (mongoose.Types.ObjectId.isValid(patientId)) {
      // Try to find by ObjectId first
      patient = await Patient.findById(patientId);
    }
    
    if (!patient) {
      // Try to find by PID (case insensitive)
      patient = await Patient.findOne({ 
        $or: [
          { pid: patientId },
          { pid: patientId.toLowerCase() },
          { pid: patientId.toUpperCase() }
        ]
      });
    }

    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }

    console.log('Patient found:', { id: patient._id, pid: patient.pid, name: `${patient.firstName} ${patient.lastName}` });

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
        address: patient.address
      },
      doctor: doctor ? {
        id: doctor._id,
        name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        specialty: doctor.specialty
      } : {
        id: 'test',
        name: 'Test Doctor',
        specialty: 'General Practice'
      }
    });

  } catch (error) {
    console.error('Error fetching patient for consultation buddy:', error);
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
});

// @route   GET /api/healthcare/consultation-buddy/:patientId
// @desc    Get consultation buddy history for a patient
// @access  Private
router.get('/consultation-buddy/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctorId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    if (!doctorId) {
      return res.status(400).json({ msg: 'Doctor ID is required' });
    }

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ msg: 'Patient not found' });
    }

    // Verify doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ msg: 'Doctor not found' });
    }

    // Get consultation buddy analyses for this patient
    const consultations = await SymptomAnalysis.find({
      patientId: patientId,
      doctorId: doctorId,
      doctorNotes: 'Consultation Buddy Analysis'
    })
    .populate('patientId', 'firstName lastName pid')
    .populate('doctorId', 'firstName lastName specialty')
    .sort({ analysisDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await SymptomAnalysis.countDocuments({
      patientId: patientId,
      doctorId: doctorId,
      doctorNotes: 'Consultation Buddy Analysis'
    });

    res.json({
      consultations,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      patient: {
        id: patient._id,
        name: `${patient.firstName} ${patient.lastName}`,
        pid: patient.pid
      },
      doctor: {
        id: doctor._id,
        name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        specialty: doctor.specialty
      }
    });

  } catch (error) {
    console.error('Error fetching consultation buddy history:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   GET /api/healthcare/doctors
// @desc    Get available doctors
// @access  Private
router.get('/doctors', async (req, res) => {
  try {
    const doctors = await Doctor.find({})
      .select('firstName lastName specialty contactNumber email')
      .sort({ firstName: 1 });
    
    res.json({
      doctors: doctors,
      total: doctors.length
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
