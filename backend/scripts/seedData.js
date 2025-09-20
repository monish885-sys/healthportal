const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const SymptomRecord = require('../models/SymptomRecord');
const MLModel = require('../models/MLModel');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for seeding');
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

// Sample patients data
const samplePatients = [
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    password: 'SecurePass123!',
    dateOfBirth: new Date('1990-01-15'),
    gender: 'male',
    phoneNumber: '+1234567890',
    address: {
      street: '123 Main Street',
      city: 'Anytown',
      state: 'CA',
      zipCode: '90210',
      country: 'US'
    },
    emergencyContact: {
      name: 'Jane Doe',
      relationship: 'Spouse',
      phoneNumber: '+1234567891',
      email: 'jane.doe@example.com'
    },
    bloodType: 'O+',
    allergies: [
      { allergen: 'Penicillin', severity: 'severe', notes: 'Causes severe rash' }
    ],
    chronicConditions: [
      { condition: 'Hypertension', diagnosisDate: new Date('2020-01-01'), status: 'active' }
    ]
  },
  {
    firstName: 'Sarah',
    lastName: 'Smith',
    email: 'sarah.smith@example.com',
    password: 'SecurePass123!',
    dateOfBirth: new Date('1985-05-20'),
    gender: 'female',
    phoneNumber: '+1234567892',
    address: {
      street: '456 Oak Avenue',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      country: 'US'
    },
    emergencyContact: {
      name: 'Mike Smith',
      relationship: 'Brother',
      phoneNumber: '+1234567893',
      email: 'mike.smith@example.com'
    },
    bloodType: 'A+',
    allergies: [],
    chronicConditions: [
      { condition: 'Diabetes Type 2', diagnosisDate: new Date('2019-06-15'), status: 'active' }
    ]
  },
  {
    firstName: 'Robert',
    lastName: 'Johnson',
    email: 'robert.johnson@example.com',
    password: 'SecurePass123!',
    dateOfBirth: new Date('1975-12-10'),
    gender: 'male',
    phoneNumber: '+1234567894',
    address: {
      street: '789 Pine Road',
      city: 'Austin',
      state: 'TX',
      zipCode: '73301',
      country: 'US'
    },
    emergencyContact: {
      name: 'Lisa Johnson',
      relationship: 'Daughter',
      phoneNumber: '+1234567895',
      email: 'lisa.johnson@example.com'
    },
    bloodType: 'B-',
    allergies: [
      { allergen: 'Shellfish', severity: 'moderate', notes: 'Causes mild stomach upset' }
    ],
    chronicConditions: []
  }
];

// Sample symptom records
const generateSymptomRecords = (patients) => {
  const records = [];
  const symptoms = [
    'fever', 'cough', 'headache', 'fatigue', 'nausea', 'vomiting', 'diarrhea',
    'abdominal_pain', 'chest_pain', 'shortness_of_breath', 'dizziness',
    'muscle_pain', 'sore_throat', 'runny_nose', 'chills', 'sweating',
    'body_aches', 'joint_pain', 'back_pain', 'neck_stiffness'
  ];
  
  const syndromes = [
    'respiratory_infection', 'gastrointestinal', 'flu', 'common_cold',
    'neurological', 'cardiac', 'unknown'
  ];

  patients.forEach(patient => {
    // Generate 3-5 symptom records per patient
    const numRecords = Math.floor(Math.random() * 3) + 3;
    
    for (let i = 0; i < numRecords; i++) {
      const numSymptoms = Math.floor(Math.random() * 4) + 1;
      const selectedSymptoms = [];
      
      for (let j = 0; j < numSymptoms; j++) {
        const symptom = symptoms[Math.floor(Math.random() * symptoms.length)];
        if (!selectedSymptoms.find(s => s.name === symptom)) {
          selectedSymptoms.push({
            name: symptom,
            severity: Math.floor(Math.random() * 10) + 1,
            duration: {
              value: Math.floor(Math.random() * 7) + 1,
              unit: ['hours', 'days'][Math.floor(Math.random() * 2)]
            },
            description: `Patient reported ${symptom}`
          });
        }
      }
      
      // Determine syndrome based on symptoms
      let predictedSyndrome = 'unknown';
      if (selectedSymptoms.some(s => ['fever', 'cough', 'shortness_of_breath'].includes(s.name))) {
        predictedSyndrome = 'respiratory_infection';
      } else if (selectedSymptoms.some(s => ['nausea', 'vomiting', 'diarrhea', 'abdominal_pain'].includes(s.name))) {
        predictedSyndrome = 'gastrointestinal';
      } else if (selectedSymptoms.some(s => ['fever', 'chills', 'muscle_pain', 'fatigue'].includes(s.name))) {
        predictedSyndrome = 'flu';
      } else if (selectedSymptoms.some(s => ['headache', 'dizziness', 'neck_stiffness'].includes(s.name))) {
        predictedSyndrome = 'neurological';
      } else if (selectedSymptoms.some(s => ['chest_pain', 'heart_palpitations'].includes(s.name))) {
        predictedSyndrome = 'cardiac';
      }
      
      const riskScore = Math.random() * 0.8;
      const confidence = 0.6 + Math.random() * 0.4;
      
      const record = {
        patientId: patient._id,
        symptoms: selectedSymptoms,
        vitalSigns: {
          temperature: {
            value: 96 + Math.random() * 8,
            unit: 'fahrenheit'
          },
          heartRate: Math.round(60 + Math.random() * 60),
          respiratoryRate: Math.round(12 + Math.random() * 16),
          bloodPressure: {
            systolic: Math.round(100 + Math.random() * 60),
            diastolic: Math.round(60 + Math.random() * 40)
          },
          oxygenSaturation: Math.round(90 + Math.random() * 10)
        },
        additionalInfo: {
          recentTravel: Math.random() > 0.8,
          recentExposure: Math.random() > 0.9,
          currentMedications: [],
          recentVaccinations: []
        },
        mlAnalysis: {
          riskScore: Math.round(riskScore * 1000) / 1000,
          predictedSyndrome: predictedSyndrome,
          confidence: Math.round(confidence * 1000) / 1000,
          recommendations: [
            'Monitor symptoms closely',
            'Rest and stay hydrated',
            'Seek medical attention if symptoms worsen'
          ],
          flaggedForReview: riskScore > 0.7 || confidence < 0.3,
          analysisTimestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        },
        location: {
          zipCode: patient.address.zipCode,
          city: patient.address.city,
          state: patient.address.state
        },
        status: 'analyzed',
        recordedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      };
      
      records.push(record);
    }
  });
  
  return records;
};

// Sample ML model
const sampleMLModel = {
  name: 'Syndromic Surveillance Model v1.0',
  version: '1.0.0',
  description: 'Neural network model for syndromic surveillance and risk assessment',
  modelType: 'neural_network',
  performance: {
    accuracy: 0.87,
    precision: 0.85,
    recall: 0.82,
    f1Score: 0.83,
    auc: 0.88
  },
  trainingInfo: {
    trainingDataSize: 1000,
    trainingDate: new Date(),
    trainingDuration: 45, // minutes
    features: [
      { name: 'fever', type: 'categorical', importance: 0.95 },
      { name: 'cough', type: 'categorical', importance: 0.88 },
      { name: 'headache', type: 'categorical', importance: 0.72 },
      { name: 'fatigue', type: 'categorical', importance: 0.68 },
      { name: 'temperature', type: 'numerical', importance: 0.92 }
    ]
  },
  modelPath: './models/sample_model.json',
  status: 'deployed',
  isActive: true,
  capabilities: {
    supportedSyndromes: ['respiratory_infection', 'gastrointestinal', 'flu', 'common_cold', 'neurological', 'cardiac'],
    maxConcurrentPredictions: 1000,
    averagePredictionTime: 150
  },
  usage: {
    totalPredictions: 0,
    successfulPredictions: 0,
    failedPredictions: 0,
    lastUsed: null
  }
};

// Seed the database
const seedDatabase = async () => {
  try {
    await connectDB();
    
    // Clear existing data
    console.log('Clearing existing data...');
    await Patient.deleteMany({});
    await SymptomRecord.deleteMany({});
    await MLModel.deleteMany({});
    
    // Create patients
    console.log('Creating sample patients...');
    const patients = [];
    for (const patientData of samplePatients) {
      const patient = new Patient(patientData);
      await patient.save();
      patients.push(patient);
      console.log(`Created patient: ${patient.fullName}`);
    }
    
    // Create symptom records
    console.log('Creating sample symptom records...');
    const symptomRecords = generateSymptomRecords(patients);
    for (const recordData of symptomRecords) {
      const record = new SymptomRecord(recordData);
      await record.save();
    }
    console.log(`Created ${symptomRecords.length} symptom records`);
    
    // Create ML model
    console.log('Creating sample ML model...');
    const mlModel = new MLModel(sampleMLModel);
    await mlModel.save();
    console.log(`Created ML model: ${mlModel.name}`);
    
    console.log('Database seeding completed successfully!');
    console.log(`\nSummary:`);
    console.log(`- Patients: ${patients.length}`);
    console.log(`- Symptom Records: ${symptomRecords.length}`);
    console.log(`- ML Models: 1`);
    console.log(`\nTest credentials:`);
    console.log(`- john.doe@example.com / SecurePass123!`);
    console.log(`- sarah.smith@example.com / SecurePass123!`);
    console.log(`- robert.johnson@example.com / SecurePass123!`);
    
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Run seeding if this script is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
