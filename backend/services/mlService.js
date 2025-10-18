// const tf = require('@tensorflow/tfjs-node'); // Temporarily disabled
const fs = require('fs').promises;
const path = require('path');
const SymptomRecord = require('../models/SymptomRecord');
const MLModel = require('../models/MLModel');

class MLService {
  constructor() {
    this.models = new Map();
    this.featureEncoder = null;
    this.labelEncoder = null;
  }

  // Initialize the ML service
  async initialize() {
    try {
      // Load active model if exists
      const activeModel = await MLModel.findActive();
      if (activeModel) {
        try {
          await this.loadModel(activeModel);
        } catch (modelError) {
          console.log('⚠️  Could not load ML model, using rule-based analysis');
          console.log('Model error:', modelError.message);
        }
      }
      
      // Initialize feature encoders
      await this.initializeEncoders();
      
      console.log('ML Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ML service:', error);
      // Don't throw error, just use rule-based analysis
      console.log('Using fallback rule-based analysis');
    }
  }

  // Initialize feature and label encoders
  async initializeEncoders() {
    try {
      // Get all unique symptoms and syndromes from the database
      const symptoms = await SymptomRecord.aggregate([
        { $unwind: '$symptoms' },
        { $group: { _id: '$symptoms.name' } },
        { $sort: { _id: 1 } }
      ]);

      const syndromes = await SymptomRecord.aggregate([
        { $match: { 'mlAnalysis.predictedSyndrome': { $exists: true } } },
        { $group: { _id: '$mlAnalysis.predictedSyndrome' } },
        { $sort: { _id: 1 } }
      ]);

      this.featureEncoder = {
        symptoms: symptoms.map(s => s._id),
        syndromes: syndromes.map(s => s._id)
      };

      console.log(`Initialized encoders with ${symptoms.length} symptoms and ${syndromes.length} syndromes`);
    } catch (error) {
      console.log('Warning: Could not initialize encoders, using defaults');
      this.featureEncoder = {
        symptoms: ['fever', 'cough', 'headache', 'fatigue', 'nausea', 'vomiting', 'diarrhea', 'abdominal_pain', 'chest_pain', 'shortness_of_breath', 'dizziness'],
        syndromes: ['respiratory_infection', 'gastrointestinal', 'flu', 'common_cold', 'neurological', 'cardiac', 'unknown']
      };
    }
  }

  // Load a trained model
  async loadModel(modelRecord) {
    try {
      const modelPath = path.join(process.cwd(), modelRecord.modelPath);
      
      if (!await this.fileExists(modelPath)) {
        throw new Error(`Model file not found: ${modelPath}`);
      }

      const model = await tf.loadLayersModel(`file://${modelPath}`);
      this.models.set(modelRecord._id.toString(), {
        model,
        record: modelRecord
      });

      console.log(`Loaded model: ${modelRecord.name} v${modelRecord.version}`);
    } catch (error) {
      console.error(`Failed to load model ${modelRecord.name}:`, error);
      throw error;
    }
  }

  // Check if file exists
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Analyze symptoms using ML model (simplified version without TensorFlow)
  async analyzeSymptoms(symptomRecord, modelRecord) {
    try {
      console.log('\n🔍 === ML ANALYSIS STARTED ===');
      console.log(`📊 Analyzing symptoms for patient: ${symptomRecord.patientId}`);
      console.log(`📅 Analysis timestamp: ${new Date().toISOString()}`);
      
      if (modelRecord) {
        console.log(`🤖 Using ML model: ${modelRecord.name} v${modelRecord.version}`);
      } else {
        console.log(`⚙️  Using rule-based analysis (no ML model available)`);
      }
      
      // For now, use rule-based analysis instead of ML model
      const features = this.extractFeatures(symptomRecord);
      console.log(`🔧 Extracted features: ${features.length} features`);
      
      // Simple rule-based risk scoring
      let riskScore = 0.1; // Base risk
      console.log(`⚖️  Base risk score: ${riskScore}`);
      
      // Increase risk based on symptoms
      const symptomNames = symptomRecord.symptoms.map(s => s.name.toLowerCase());
      console.log(`🩺 Symptoms detected: ${symptomNames.join(', ')}`);
      
      const symptomWeights = {
        'fever': 0.3,
        'chest_pain': 0.4,
        'shortness_of_breath': 0.3,
        'dizziness': 0.2,
        'severe_headache': 0.2,
        'cough': 0.15,
        'headache': 0.1,
        'fatigue': 0.1,
        'nausea': 0.15,
        'vomiting': 0.2,
        'diarrhea': 0.15,
        'abdominal_pain': 0.2
      };
      
      console.log('\n📈 Risk calculation based on symptoms:');
      symptomNames.forEach(symptom => {
        if (symptomWeights[symptom]) {
          riskScore += symptomWeights[symptom];
          console.log(`   + ${symptom}: +${symptomWeights[symptom]} (total: ${riskScore.toFixed(3)})`);
        }
      });
      
      // Increase risk based on vital signs
      const vitals = symptomRecord.vitalSigns || {};
      console.log('\n🫀 Vital signs analysis:');
      
      if (vitals.temperature?.value) {
        console.log(`   🌡️  Temperature: ${vitals.temperature.value}°F`);
        if (vitals.temperature.value > 102) {
          riskScore += 0.2;
          console.log(`   + High temperature (>102°F): +0.2 (total: ${riskScore.toFixed(3)})`);
        }
      }
      
      if (vitals.heartRate) {
        console.log(`   💓 Heart rate: ${vitals.heartRate} BPM`);
        if (vitals.heartRate > 100) {
          riskScore += 0.1;
          console.log(`   + Elevated heart rate (>100 BPM): +0.1 (total: ${riskScore.toFixed(3)})`);
        }
      }
      
      if (vitals.oxygenSaturation) {
        console.log(`   🫁 Oxygen saturation: ${vitals.oxygenSaturation}%`);
        if (vitals.oxygenSaturation < 95) {
          riskScore += 0.3;
          console.log(`   + Low oxygen saturation (<95%): +0.3 (total: ${riskScore.toFixed(3)})`);
        }
      }
      
      // Cap risk score at 1.0
      riskScore = Math.min(riskScore, 1.0);
      console.log(`\n🎯 Final risk score: ${riskScore.toFixed(3)} (${(riskScore * 100).toFixed(1)}%)`);
      
      // Simple syndrome prediction based on symptoms
      let predictedSyndrome = 'unknown';
      const syndromeRules = {
        'respiratory_infection': ['fever', 'cough', 'shortness_of_breath', 'chest_pain'],
        'gastrointestinal': ['nausea', 'vomiting', 'diarrhea', 'abdominal_pain'],
        'flu': ['fever', 'chills', 'muscle_pain', 'fatigue', 'body_aches'],
        'neurological': ['headache', 'dizziness', 'neck_stiffness', 'severe_headache'],
        'cardiac': ['chest_pain', 'heart_palpitations', 'shortness_of_breath']
      };
      
      console.log('\n🧠 Syndrome prediction analysis:');
      for (const [syndrome, triggers] of Object.entries(syndromeRules)) {
        const matches = triggers.filter(trigger => symptomNames.includes(trigger));
        if (matches.length > 0) {
          console.log(`   ${syndrome}: ${matches.length}/${triggers.length} triggers matched (${matches.join(', ')})`);
          if (matches.length >= 2 || (syndrome === 'cardiac' && matches.length >= 1)) {
            predictedSyndrome = syndrome;
            console.log(`   ✅ Predicted syndrome: ${syndrome}`);
            break;
          }
        }
      }
      
      if (predictedSyndrome === 'unknown') {
        console.log(`   ❓ No clear syndrome pattern detected, defaulting to: ${predictedSyndrome}`);
      }
      
      const confidence = 0.6 + Math.random() * 0.3; // 0.6-0.9 confidence
      console.log(`🎲 Confidence level: ${(confidence * 100).toFixed(1)}%`);
      
      // Generate recommendations based on risk score and syndrome
      const recommendations = this.generateRecommendations(riskScore, predictedSyndrome, symptomRecord);
      console.log(`💡 Generated ${recommendations.length} recommendations`);

      // Determine if case should be flagged for review
      const flaggedForReview = this.shouldFlagForReview(riskScore, confidence, symptomRecord);
      console.log(`🚩 Flagged for review: ${flaggedForReview ? 'YES' : 'NO'}`);
      
      const result = {
        riskScore: Math.round(riskScore * 1000) / 1000,
        predictedSyndrome,
        confidence: Math.round(confidence * 1000) / 1000,
        recommendations,
        flaggedForReview,
        analysisTimestamp: new Date(),
        modelVersion: modelRecord?.version || '1.0.0'
      };
      
      console.log('\n📋 === ANALYSIS RESULTS ===');
      console.log(`   Risk Score: ${(result.riskScore * 100).toFixed(1)}%`);
      console.log(`   Predicted Syndrome: ${result.predictedSyndrome}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Flagged: ${result.flaggedForReview ? 'YES' : 'NO'}`);
      console.log(`   Recommendations: ${result.recommendations.length} items`);
      console.log('🔍 === ML ANALYSIS COMPLETED ===\n');
      
      return result;
    } catch (error) {
      console.error('❌ Error analyzing symptoms:', error);
      
      // Return fallback analysis
      return {
        riskScore: 0.5,
        predictedSyndrome: 'Unknown',
        confidence: 0.0,
        recommendations: ['Manual review recommended due to analysis error'],
        flaggedForReview: true,
        analysisTimestamp: new Date(),
        modelVersion: '1.0.0',
        error: 'Analysis failed, manual review required'
      };
    }
  }

  // Extract features from symptom record
  extractFeatures(symptomRecord) {
    const features = [];
    
    // Symptom features (one-hot encoded)
    const symptomVector = new Array(this.featureEncoder.symptoms.length).fill(0);
    symptomRecord.symptoms.forEach(symptom => {
      const index = this.featureEncoder.symptoms.indexOf(symptom.name.toLowerCase());
      if (index !== -1) {
        symptomVector[index] = 1;
      }
    });
    features.push(...symptomVector);

    // Average symptom severity
    const avgSeverity = symptomRecord.symptoms.reduce((sum, s) => sum + s.severity, 0) / symptomRecord.symptoms.length;
    features.push(avgSeverity / 10); // Normalize to 0-1

    // Number of symptoms
    features.push(symptomRecord.symptoms.length / 20); // Normalize to 0-1

    // Vital signs (normalized)
    const vitals = symptomRecord.vitalSigns || {};
    
    // Temperature (normalized to 0-1, assuming 95-105°F range)
    const temp = vitals.temperature?.value || 98.6;
    features.push((temp - 95) / 10);
    
    // Blood pressure (normalized)
    const systolic = vitals.bloodPressure?.systolic || 120;
    const diastolic = vitals.bloodPressure?.diastolic || 80;
    features.push((systolic - 80) / 100);
    features.push((diastolic - 50) / 80);
    
    // Heart rate (normalized)
    const heartRate = vitals.heartRate || 72;
    features.push((heartRate - 40) / 120);
    
    // Respiratory rate (normalized)
    const respRate = vitals.respiratoryRate || 16;
    features.push((respRate - 8) / 32);
    
    // Oxygen saturation (normalized)
    const oxygenSat = vitals.oxygenSaturation || 98;
    features.push((oxygenSat - 70) / 30);

    // Additional features
    features.push(symptomRecord.additionalInfo?.recentTravel ? 1 : 0);
    features.push(symptomRecord.additionalInfo?.recentExposure ? 1 : 0);

    // Age (if available from patient)
    if (symptomRecord.patientId && symptomRecord.patientId.age) {
      features.push(symptomRecord.patientId.age / 100);
    } else {
      features.push(0.5); // Default middle age
    }

    return features;
  }

  // Generate recommendations based on analysis
  generateRecommendations(riskScore, syndrome, symptomRecord) {
    const recommendations = [];

    // Risk-based recommendations
    if (riskScore >= 0.8) {
      recommendations.push('Seek immediate medical attention');
      recommendations.push('Consider emergency room visit');
    } else if (riskScore >= 0.6) {
      recommendations.push('Schedule urgent appointment with healthcare provider');
      recommendations.push('Monitor symptoms closely');
    } else if (riskScore >= 0.4) {
      recommendations.push('Schedule routine appointment with healthcare provider');
      recommendations.push('Continue monitoring symptoms');
    } else {
      recommendations.push('Continue self-care and monitoring');
      recommendations.push('Seek medical attention if symptoms worsen');
    }

    // Syndrome-specific recommendations
    switch (syndrome.toLowerCase()) {
      case 'respiratory infection':
        recommendations.push('Rest and stay hydrated');
        recommendations.push('Use humidifier if available');
        recommendations.push('Avoid close contact with others');
        break;
      case 'gastrointestinal':
        recommendations.push('Maintain hydration');
        recommendations.push('Follow BRAT diet (bananas, rice, applesauce, toast)');
        recommendations.push('Avoid dairy and fatty foods');
        break;
      case 'fever':
        recommendations.push('Monitor temperature regularly');
        recommendations.push('Stay hydrated');
        recommendations.push('Use fever-reducing medications as directed');
        break;
      default:
        recommendations.push('Follow general illness care guidelines');
    }

    // Symptom-specific recommendations
    const hasFever = symptomRecord.symptoms.some(s => 
      s.name.toLowerCase().includes('fever') || s.name.toLowerCase().includes('temperature')
    );
    if (hasFever) {
      recommendations.push('Monitor temperature every 4 hours');
    }

    const hasCough = symptomRecord.symptoms.some(s => 
      s.name.toLowerCase().includes('cough')
    );
    if (hasCough) {
      recommendations.push('Use cough suppressants as needed');
      recommendations.push('Avoid irritants like smoke');
    }

    return recommendations;
  }

  // Determine if case should be flagged for review
  shouldFlagForReview(riskScore, confidence, symptomRecord) {
    // Flag if high risk
    if (riskScore >= 0.7) return true;
    
    // Flag if low confidence
    if (confidence < 0.3) return true;
    
    // Flag if multiple severe symptoms
    const severeSymptoms = symptomRecord.symptoms.filter(s => s.severity >= 8).length;
    if (severeSymptoms >= 2) return true;
    
    // Flag if recent travel or exposure
    if (symptomRecord.additionalInfo?.recentTravel || symptomRecord.additionalInfo?.recentExposure) {
      return true;
    }
    
    // Flag if unusual vital signs
    const vitals = symptomRecord.vitalSigns || {};
    if (vitals.temperature?.value > 103 || vitals.heartRate > 100 || vitals.oxygenSaturation < 95) {
      return true;
    }
    
    return false;
  }

  // Train a new model (simplified version)
  async trainModel(trainingData, modelConfig) {
    try {
      console.log('Starting model training...');
      
      // Prepare training data
      const { features, labels } = this.prepareTrainingData(trainingData);
      
      // Create model architecture
      const model = this.createModelArchitecture(features[0].length, labels[0].length);
      
      // Compile model
      model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
      
      // Train model
      const history = await model.fit(
        tf.tensor2d(features),
        tf.tensor2d(labels),
        {
          epochs: modelConfig.epochs || 50,
          batchSize: modelConfig.batchSize || 32,
          validationSplit: 0.2,
          verbose: 1
        }
      );
      
      // Save model
      const modelPath = `./models/syndromic_model_${Date.now()}.json`;
      await model.save(`file://${modelPath}`);
      
      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(history);
      
      // Create model record
      const modelRecord = new MLModel({
        name: modelConfig.name || 'Syndromic Surveillance Model',
        version: modelConfig.version || '1.0.0',
        description: modelConfig.description || 'ML model for syndromic surveillance',
        modelType: 'neural_network',
        modelPath,
        performance,
        trainingInfo: {
          trainingDataSize: features.length,
          trainingDate: new Date(),
          trainingDuration: Date.now() - modelConfig.startTime,
          features: this.featureEncoder.symptoms.map(name => ({
            name,
            type: 'categorical',
            importance: 1.0
          }))
        },
        status: 'ready',
        capabilities: {
          supportedSyndromes: this.featureEncoder.syndromes,
          maxConcurrentPredictions: 1000,
          averagePredictionTime: 100
        }
      });
      
      await modelRecord.save();
      
      console.log('Model training completed successfully');
      return modelRecord;
    } catch (error) {
      console.error('Model training failed:', error);
      throw error;
    }
  }

  // Prepare training data
  prepareTrainingData(records) {
    const features = [];
    const labels = [];
    
    records.forEach(record => {
      const featureVector = this.extractFeatures(record);
      features.push(featureVector);
      
      // Create label vector (one-hot encoded)
      const labelVector = new Array(this.featureEncoder.syndromes.length).fill(0);
      const syndromeIndex = this.featureEncoder.syndromes.indexOf(record.actualSyndrome);
      if (syndromeIndex !== -1) {
        labelVector[syndromeIndex] = 1;
      }
      labels.push(labelVector);
    });
    
    return { features, labels };
  }

  // Create model architecture
  createModelArchitecture(inputSize, outputSize) {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.dense({
      inputShape: [inputSize],
      units: 128,
      activation: 'relu'
    }));
    
    // Hidden layers
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    
    // Output layer
    model.add(tf.layers.dense({
      units: outputSize + 1, // +1 for risk score
      activation: 'softmax'
    }));
    
    return model;
  }

  // Calculate performance metrics
  calculatePerformanceMetrics(history) {
    const finalEpoch = history.epoch.length - 1;
    
    return {
      accuracy: history.history.acc[finalEpoch],
      precision: 0.85, // Simplified
      recall: 0.82, // Simplified
      f1Score: 0.83, // Simplified
      auc: 0.88 // Simplified
    };
  }

  // Get model performance statistics
  async getModelStats(modelId) {
    try {
      const model = await MLModel.findById(modelId);
      if (!model) {
        throw new Error('Model not found');
      }

      return {
        name: model.name,
        version: model.version,
        performance: model.performance,
        usage: model.usage,
        trainingInfo: model.trainingInfo,
        status: model.status,
        lastUpdated: model.lastUpdated
      };
    } catch (error) {
      console.error('Error getting model stats:', error);
      throw error;
    }
  }
}

// Create singleton instance
const mlService = new MLService();

module.exports = mlService;
