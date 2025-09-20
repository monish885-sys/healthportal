const MLService = require('../services/mlService');
const SymptomRecord = require('../models/SymptomRecord');
const MLModel = require('../models/MLModel');
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for training');
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

// Generate synthetic training data
const generateSyntheticData = async (count = 1000) => {
  console.log(`Generating ${count} synthetic training records...`);
  
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
  
  const records = [];
  
  for (let i = 0; i < count; i++) {
    // Random number of symptoms (1-5)
    const numSymptoms = Math.floor(Math.random() * 5) + 1;
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
          }
        });
      }
    }
    
    // Generate vital signs
    const temperature = 96 + Math.random() * 8; // 96-104°F
    const heartRate = 60 + Math.random() * 60; // 60-120 bpm
    const respiratoryRate = 12 + Math.random() * 16; // 12-28 rpm
    const systolicBP = 100 + Math.random() * 60; // 100-160 mmHg
    const diastolicBP = 60 + Math.random() * 40; // 60-100 mmHg
    const oxygenSat = 90 + Math.random() * 10; // 90-100%
    
    // Determine syndrome based on symptoms
    let actualSyndrome = 'unknown';
    if (selectedSymptoms.some(s => ['fever', 'cough', 'shortness_of_breath'].includes(s.name))) {
      actualSyndrome = 'respiratory_infection';
    } else if (selectedSymptoms.some(s => ['nausea', 'vomiting', 'diarrhea', 'abdominal_pain'].includes(s.name))) {
      actualSyndrome = 'gastrointestinal';
    } else if (selectedSymptoms.some(s => ['fever', 'chills', 'muscle_pain', 'fatigue'].includes(s.name))) {
      actualSyndrome = 'flu';
    } else if (selectedSymptoms.some(s => ['headache', 'dizziness', 'neck_stiffness'].includes(s.name))) {
      actualSyndrome = 'neurological';
    } else if (selectedSymptoms.some(s => ['chest_pain', 'heart_palpitations'].includes(s.name))) {
      actualSyndrome = 'cardiac';
    }
    
    const record = {
      symptoms: selectedSymptoms,
      vitalSigns: {
        temperature: { value: temperature, unit: 'fahrenheit' },
        heartRate: Math.round(heartRate),
        respiratoryRate: Math.round(respiratoryRate),
        bloodPressure: {
          systolic: Math.round(systolicBP),
          diastolic: Math.round(diastolicBP)
        },
        oxygenSaturation: Math.round(oxygenSat)
      },
      additionalInfo: {
        recentTravel: Math.random() > 0.8,
        recentExposure: Math.random() > 0.9
      },
      location: {
        zipCode: String(10000 + Math.floor(Math.random() * 90000)),
        city: 'Sample City',
        state: 'Sample State'
      },
      actualSyndrome,
      recordedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Last 30 days
    };
    
    records.push(record);
  }
  
  return records;
};

// Train the model
const trainModel = async () => {
  try {
    await connectDB();
    
    // Initialize ML service
    const mlService = new MLService();
    await mlService.initialize();
    
    // Generate or get training data
    let trainingData;
    const existingRecords = await SymptomRecord.find({ 'mlAnalysis.predictedSyndrome': { $exists: true } }).limit(1000);
    
    if (existingRecords.length >= 100) {
      console.log(`Using ${existingRecords.length} existing records for training`);
      trainingData = existingRecords.map(record => ({
        ...record.toObject(),
        actualSyndrome: record.mlAnalysis.predictedSyndrome
      }));
    } else {
      console.log('Generating synthetic training data...');
      trainingData = await generateSyntheticData(500);
    }
    
    // Train model
    const modelConfig = {
      name: 'Syndromic Surveillance Model',
      version: '1.0.0',
      description: 'Neural network for syndromic surveillance and risk assessment',
      epochs: 50,
      batchSize: 32,
      startTime: Date.now()
    };
    
    console.log('Starting model training...');
    const modelRecord = await mlService.trainModel(trainingData, modelConfig);
    
    console.log('Model training completed successfully!');
    console.log('Model ID:', modelRecord._id);
    console.log('Model Path:', modelRecord.modelPath);
    console.log('Performance:', modelRecord.performance);
    
    // Set as active model
    await MLModel.updateMany({}, { isActive: false });
    modelRecord.isActive = true;
    modelRecord.status = 'deployed';
    await modelRecord.save();
    
    console.log('Model set as active and deployed');
    
  } catch (error) {
    console.error('Training failed:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Run training if this script is executed directly
if (require.main === module) {
  trainModel();
}

module.exports = { trainModel, generateSyntheticData };
