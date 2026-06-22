# Symptom-Based Disease Analyzer

This document describes the new symptom-based disease analyzer feature that has been added to the health portal API.

## Overview

The symptom analyzer uses machine learning to predict diseases based on patient symptoms. It analyzes symptoms using a trained Naive Bayes model and provides confidence scores for disease predictions.

## Components

### 1. SymptomAnalysis Model (`Models/SymptomAnalysis.js`)
- Stores symptom analysis results in the database
- Tracks patient symptoms, predicted diseases, confidence scores
- Includes doctor review functionality
- Tracks analysis history and statistics

### 2. Python ML Service (`symptom_analyzer.py`)
- Trains and loads the ML model using scikit-learn
- Analyzes symptoms and returns disease predictions
- Provides confidence scores and top predictions
- Extracts available symptoms from the dataset

### 3. API Routes (`routes/healthcareRoutes.js`)
New endpoints added for symptom analysis:

#### POST `/api/healthcare/symptom-analysis`
Analyze patient symptoms using ML model
```json
{
  "symptoms": ["itching", "skin_rash", "nodal_skin_eruptions"],
  "userId": "user_id_here"
}
```

#### GET `/api/healthcare/symptom-analysis`
Get symptom analysis history for a patient
- Query params: `userId`, `patientId`, `page`, `limit`, `status`

#### GET `/api/healthcare/symptom-analysis/:id`
Get specific symptom analysis by ID
- Query params: `userId`

#### PUT `/api/healthcare/symptom-analysis/:id`
Update symptom analysis (doctor review)
```json
{
  "userId": "doctor_user_id",
  "doctorNotes": "Review notes",
  "status": "reviewed_by_doctor",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "followUpRequired": true,
  "followUpDate": "2024-01-15"
}
```

#### GET `/api/healthcare/available-symptoms`
Get list of all available symptoms from the dataset

#### GET `/api/healthcare/disease-info/:diseaseName`
Get information about a specific disease

#### GET `/api/healthcare/symptom-analysis-stats`
Get symptom analysis statistics for a patient

### 4. Updated Patient Model (`Models/patient.js`)
- Added `symptomAnalysisHistory` field to track analysis statistics
- Methods to update and retrieve analysis history
- Risk level calculation based on analysis history

## Features

### Symptom Analysis
- **Input**: Array of symptoms
- **Output**: Predicted disease with confidence score
- **Top Predictions**: Returns top 5 disease predictions with confidence scores
- **Severity Assessment**: Automatically determines severity level
- **Emergency Detection**: Flags critical diseases as emergencies

### Patient History Tracking
- Tracks total number of analyses
- Records emergency and high-risk analyses
- Calculates patient risk level
- Stores last analysis date

### Doctor Review System
- Doctors can review and update analysis results
- Add notes and recommendations
- Set follow-up requirements
- Update analysis status

## Usage Examples

### 1. Analyze Symptoms
```javascript
const response = await fetch('/api/healthcare/symptom-analysis', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    symptoms: ["fever", "headache", "nausea"],
    userId: "user_id"
  })
});

const result = await response.json();
console.log(result.analysis.predictedDisease);
console.log(result.analysis.confidence);
```

### 2. Get Available Symptoms
```javascript
const response = await fetch('/api/healthcare/available-symptoms', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

const result = await response.json();
console.log(result.symptoms); // Array of all available symptoms
```

### 3. Get Analysis History
```javascript
const response = await fetch('/api/healthcare/symptom-analysis?userId=user_id&page=1&limit=10', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

const result = await response.json();
console.log(result.analyses); // Array of analysis history
```

## Model Training

The ML model is automatically trained when the analyzer is first initialized. The model:
- Uses TF-IDF vectorization for symptom text
- Trains a Multinomial Naive Bayes classifier
- Saves the trained model and vectorizer for reuse
- Provides confidence scores for predictions

## Testing

Run the test script to verify the analyzer:
```bash
python3 test_symptom_analyzer.py
```

## Dependencies

### Python Dependencies
- pandas
- scikit-learn
- numpy
- pickle (built-in)

### Node.js Dependencies
- mongoose (for database models)
- express (for API routes)
- child_process (for running Python scripts)

## Security Considerations

- All API endpoints require authentication
- Patient data is properly isolated by user ID
- Doctor review functionality is restricted to doctor role
- Temporary Python scripts are cleaned up after execution

## Future Enhancements

1. **Real-time Analysis**: WebSocket support for real-time symptom analysis
2. **Advanced ML Models**: Support for more sophisticated ML algorithms
3. **Symptom Validation**: Validate symptoms against medical databases
4. **Integration**: Integration with external medical APIs
5. **Analytics**: Advanced analytics and reporting features
6. **Mobile Support**: Optimized for mobile applications

## Troubleshooting

### Common Issues

1. **Python Dependencies**: Ensure all Python packages are installed
2. **Model Loading**: Check if the model files exist in the models directory
3. **Dataset Path**: Verify the dataset path in the analyzer configuration
4. **Permissions**: Ensure proper file permissions for model saving/loading

### Error Handling

The system includes comprehensive error handling:
- Invalid symptoms are rejected
- Missing user authentication returns 401
- Model loading failures are handled gracefully
- Database errors are properly logged and returned
