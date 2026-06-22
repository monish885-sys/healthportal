# Disease Tracking and Outbreak Detection System

This document describes the comprehensive disease tracking and outbreak detection system implemented in the health portal API.

## Overview

The system automatically tracks disease cases from symptom analysis, detects potential outbreaks, and provides comprehensive analytics for hospital administrators to monitor disease patterns and hospital capacity.

## Key Features

### 🔍 **Automatic Disease Case Tracking**
- Every symptom analysis automatically creates a disease case record
- Tracks disease name, confidence, severity, location, and timestamp
- Links cases to patients and symptom analyses
- Supports case status updates and doctor reviews

### 🚨 **Outbreak Detection**
- Automatically detects potential outbreaks based on configurable thresholds
- Monitors disease patterns within specified time windows
- Classifies outbreaks by severity (low, medium, high, critical)
- Tracks outbreak progression and resolution

### 📊 **Comprehensive Analytics**
- Real-time disease statistics and trends
- Hospital capacity impact analysis
- Resource utilization tracking
- Emergency case monitoring

### 🏥 **Hospital Impact Monitoring**
- Tracks how diseases affect hospital operations
- Monitors emergency department capacity
- Provides capacity pressure indicators
- Generates actionable recommendations

## System Components

### 1. DiseaseCase Model (`Models/DiseaseCase.js`)
Tracks individual disease cases with comprehensive metadata:

```javascript
{
  patientId: ObjectId,
  userId: ObjectId,
  symptomAnalysisId: ObjectId,
  diseaseName: String,
  confidence: Number,
  symptoms: [String],
  caseDate: Date,
  location: String,
  severity: String,
  isEmergency: Boolean,
  status: String,
  isOutbreakRelated: Boolean,
  outbreakId: ObjectId
}
```

**Key Methods:**
- `getDiseaseStats()` - Get comprehensive disease statistics
- `getDiseaseTrends()` - Get disease trends over time
- `getTopDiseases()` - Get most common diseases
- `detectPotentialOutbreaks()` - Detect potential outbreaks
- `getRecentCases()` - Get recent disease cases

### 2. DiseaseOutbreak Model (`Models/DiseaseOutbreak.js`)
Manages disease outbreak tracking and management:

```javascript
{
  diseaseName: String,
  location: String,
  startDate: Date,
  endDate: Date,
  status: String,
  severity: String,
  totalCases: Number,
  emergencyCases: Number,
  criticalCases: Number,
  resolvedCases: Number,
  threshold: Number,
  timeWindow: Number,
  actions: [Action],
  recommendations: [String],
  affectedPatients: [ObjectId]
}
```

**Key Methods:**
- `detectNewOutbreaks()` - Automatically detect new outbreaks
- `getActiveOutbreaks()` - Get currently active outbreaks
- `getOutbreakStats()` - Get outbreak statistics
- `updateStatistics()` - Update outbreak statistics
- `addAction()` - Add management actions

### 3. Admin Disease Routes (`routes/adminDiseaseRoutes.js`)
Comprehensive API endpoints for disease monitoring:

#### Disease Cases Management
- `GET /api/admin/disease/disease-cases` - Get all disease cases with filters
- `GET /api/admin/disease/disease-cases/:id` - Get specific disease case
- `PUT /api/admin/disease/disease-case/:id` - Update disease case status

#### Disease Statistics & Analytics
- `GET /api/admin/disease/disease-stats` - Get comprehensive disease statistics
- `GET /api/admin/disease/disease-trends/:diseaseName` - Get disease trends
- `GET /api/admin/disease/hospital-impact` - Get hospital impact analysis

#### Outbreak Monitoring
- `GET /api/admin/disease/outbreaks` - Get all outbreaks
- `POST /api/admin/disease/outbreaks/detect` - Manually trigger outbreak detection
- `GET /api/admin/disease/outbreaks/stats` - Get outbreak statistics
- `PUT /api/admin/disease/outbreaks/:id` - Update outbreak information
- `POST /api/admin/disease/outbreaks/:id/actions` - Add outbreak actions

## API Usage Examples

### 1. Get Disease Statistics
```javascript
const response = await fetch('/api/admin/disease/disease-stats?timeRange=30', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const data = await response.json();
console.log('Total cases:', data.overallStats.totalCases);
console.log('Top diseases:', data.topDiseases);
console.log('Potential outbreaks:', data.potentialOutbreaks);
```

### 2. Monitor Outbreaks
```javascript
const response = await fetch('/api/admin/disease/outbreaks/stats', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const data = await response.json();
console.log('Active outbreaks:', data.stats.activeOutbreaks);
console.log('Critical outbreaks:', data.stats.criticalOutbreaks);
```

### 3. Detect New Outbreaks
```javascript
const response = await fetch('/api/admin/disease/outbreaks/detect', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    threshold: 3,
    timeWindow: 7
  })
});

const data = await response.json();
console.log('New outbreaks detected:', data.count);
```

### 4. Get Hospital Impact
```javascript
const response = await fetch('/api/admin/disease/hospital-impact?days=30', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const data = await response.json();
console.log('Capacity pressure:', data.capacityPressure.pressureLevel);
console.log('Recommendations:', data.recommendations);
```

## Outbreak Detection Algorithm

The system uses a sophisticated algorithm to detect potential outbreaks:

### 1. **Data Collection**
- Monitors all disease cases within a configurable time window
- Groups cases by disease name and location
- Tracks case counts, severity, and emergency status

### 2. **Threshold Analysis**
- Compares case counts against configurable thresholds
- Default threshold: 3 cases within 7 days
- Adjustable based on hospital size and disease type

### 3. **Severity Classification**
- **Low**: 3-4 cases, no emergency cases
- **Medium**: 5-9 cases, or 1-2 emergency cases
- **High**: 10-19 cases, or 3-4 emergency cases
- **Critical**: 20+ cases, or 5+ emergency cases

### 4. **Outbreak Creation**
- Automatically creates outbreak records for threshold breaches
- Links all related disease cases
- Generates initial recommendations and actions

## Hospital Capacity Monitoring

The system provides real-time hospital capacity monitoring:

### **Capacity Pressure Indicators**
- **Low**: Normal operations, routine monitoring
- **Medium**: Increased vigilance, ensure adequate staffing
- **High**: Activate emergency protocols, increase staffing

### **Resource Utilization Tracking**
- Emergency department capacity
- Critical care unit utilization
- Staffing requirements
- Equipment availability

### **Automated Recommendations**
- Staffing adjustments
- Resource allocation
- Emergency protocol activation
- Patient flow optimization

## Dashboard Features

### **Real-time Monitoring**
- Live disease case counts
- Active outbreak status
- Emergency case alerts
- Capacity pressure indicators

### **Trend Analysis**
- Disease trends over time
- Seasonal patterns
- Outbreak progression
- Resolution rates

### **Alert System**
- Outbreak detection alerts
- Capacity pressure warnings
- Emergency case notifications
- Threshold breach alerts

## Configuration Options

### **Outbreak Detection Settings**
```javascript
{
  threshold: 3,        // Minimum cases for outbreak detection
  timeWindow: 7,       // Time window in days
  location: 'Care and Cure Hospital'
}
```

### **Severity Thresholds**
```javascript
{
  low: { cases: 3, emergency: 0 },
  medium: { cases: 5, emergency: 1 },
  high: { cases: 10, emergency: 3 },
  critical: { cases: 20, emergency: 5 }
}
```

## Testing

Run the test script to verify the system:

```bash
node test_disease_tracking.js
```

The test will:
- Create sample disease cases
- Test outbreak detection
- Verify statistics generation
- Check trend analysis
- Validate outbreak management

## Security & Privacy

- All endpoints require admin authentication
- Patient data is properly anonymized in analytics
- Outbreak data is restricted to authorized personnel
- Audit trails for all outbreak management actions

## Future Enhancements

1. **Machine Learning Integration**
   - Predictive outbreak modeling
   - Risk assessment algorithms
   - Automated response recommendations

2. **External Data Integration**
   - Public health databases
   - Weather data correlation
   - Population density analysis

3. **Advanced Analytics**
   - Geographic outbreak mapping
   - Transmission pattern analysis
   - Resource optimization algorithms

4. **Mobile Alerts**
   - Push notifications for outbreaks
   - Mobile dashboard access
   - Emergency response coordination

## Troubleshooting

### Common Issues

1. **Outbreak Detection Not Working**
   - Check threshold settings
   - Verify time window configuration
   - Ensure disease cases are being created

2. **Statistics Not Updating**
   - Check database connections
   - Verify model relationships
   - Run manual statistics update

3. **Performance Issues**
   - Optimize database indexes
   - Implement data archiving
   - Use pagination for large datasets

### Error Handling

The system includes comprehensive error handling:
- Database connection failures
- Invalid threshold configurations
- Missing required data
- Permission errors

## Support

For technical support or feature requests, please refer to the main health portal documentation or contact the development team.
