# Health Portal API

A secure and efficient healthcare data management system with ML-powered syndromic surveillance built with Node.js, Express.js, and MongoDB.

## Features

- **Patient Authentication & Registration**: Secure JWT-based authentication with role-based access control
- **ML-Powered Syndromic Surveillance**: Real-time analysis of symptoms using machine learning models
- **Comprehensive Patient Management**: Complete patient profiles with medical history and emergency contacts
- **Real-time Risk Assessment**: Automated risk scoring and alert generation
- **Geographic Surveillance**: Location-based syndromic trend analysis
- **RESTful API**: Well-documented endpoints with comprehensive validation

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **ML Framework**: TensorFlow.js
- **Security**: Helmet, CORS, Rate Limiting, Input Validation
- **Documentation**: Comprehensive API documentation

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd health-portal-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/health_portal
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=7d
   BCRYPT_ROUNDS=12
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB service
   sudo systemctl start mongod
   
   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/api/auth/register` | Register new patient | Public |
| POST | `/api/auth/login` | Patient login | Public |
| POST | `/api/auth/refresh` | Refresh JWT token | Private |
| POST | `/api/auth/logout` | Logout patient | Private |
| POST | `/api/auth/forgot-password` | Request password reset | Public |
| POST | `/api/auth/reset-password` | Reset password with token | Public |
| GET | `/api/auth/me` | Get current patient profile | Private |

### Patient Management

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/api/patients/profile` | Get patient profile | Private |
| PUT | `/api/patients/profile` | Update patient profile | Private |
| POST | `/api/patients/change-password` | Change password | Private |
| POST | `/api/patients/symptoms` | Submit symptom record | Private |
| GET | `/api/patients/symptoms` | Get symptom records | Private |
| GET | `/api/patients/symptoms/:id` | Get specific symptom record | Private |
| GET | `/api/patients/dashboard` | Get dashboard data | Private |
| DELETE | `/api/patients/account` | Deactivate account | Private |

### ML & Surveillance

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/api/ml/analyze` | Analyze symptoms with ML | Private |
| GET | `/api/ml/surveillance` | Get surveillance data | Private |
| GET | `/api/ml/trends` | Get syndromic trends | Private |
| GET | `/api/ml/alerts` | Get high-risk alerts | Private |
| GET | `/api/ml/models` | Get available ML models | Private |
| GET | `/api/ml/models/:id` | Get specific model details | Private |

## Usage Examples

### Patient Registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "dateOfBirth": "1990-01-01",
    "gender": "male",
    "phoneNumber": "+1234567890",
    "address": {
      "street": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "zipCode": "12345",
      "country": "US"
    },
    "emergencyContact": {
      "name": "Jane Doe",
      "relationship": "Spouse",
      "phoneNumber": "+1234567891",
      "email": "jane.doe@example.com"
    }
  }'
```

### Patient Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!"
  }'
```

### Submit Symptom Record

```bash
curl -X POST http://localhost:3000/api/patients/symptoms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "symptoms": [
      {
        "name": "fever",
        "severity": 8,
        "duration": {
          "value": 2,
          "unit": "days"
        },
        "description": "High fever with chills"
      },
      {
        "name": "cough",
        "severity": 6,
        "duration": {
          "value": 3,
          "unit": "days"
        }
      }
    ],
    "vitalSigns": {
      "temperature": {
        "value": 101.5,
        "unit": "fahrenheit"
      },
      "heartRate": 95,
      "respiratoryRate": 22,
      "bloodPressure": {
        "systolic": 130,
        "diastolic": 85
      },
      "oxygenSaturation": 96
    },
    "additionalInfo": {
      "recentTravel": false,
      "recentExposure": false
    },
    "location": {
      "zipCode": "12345",
      "city": "Anytown",
      "state": "CA"
    }
  }'
```

### ML Analysis

```bash
curl -X POST http://localhost:3000/api/ml/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "symptomRecordId": "SYMPTOM_RECORD_ID"
  }'
```

## ML Model Training

To train a new ML model for syndromic surveillance:

```bash
# Run the training script
node scripts/trainModel.js
```

The training script will:
1. Generate synthetic training data (if no real data exists)
2. Train a neural network model
3. Save the model to the `./models/` directory
4. Create a model record in the database
5. Set the model as active for predictions

## Database Schema

### Patient Collection
- Personal information (name, email, DOB, gender)
- Contact details (phone, address)
- Medical information (blood type, allergies, conditions)
- Emergency contact information
- Account status and security fields

### SymptomRecord Collection
- Patient reference
- Symptom details (name, severity, duration)
- Vital signs (temperature, blood pressure, etc.)
- ML analysis results (risk score, predicted syndrome)
- Location data for surveillance
- Timestamps and status

### MLModel Collection
- Model metadata (name, version, type)
- Performance metrics (accuracy, precision, recall)
- Training information
- Usage statistics
- Deployment status

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with configurable rounds
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Protection against brute force attacks
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: Security headers and protection
- **Data Sanitization**: Protection against injection attacks

## Error Handling

The API provides comprehensive error handling with:
- Consistent error response format
- Detailed validation error messages
- Proper HTTP status codes
- Security-conscious error messages
- Request logging and monitoring

## Development

### Running Tests
```bash
npm test
```

### Code Linting
```bash
npm run lint
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/health_portal |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRE` | JWT expiration time | 7d |
| `BCRYPT_ROUNDS` | Password hashing rounds | 12 |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact the development team or create an issue in the repository.

## Changelog

### v1.0.0
- Initial release
- Patient authentication and registration
- ML-powered syndromic surveillance
- Comprehensive API endpoints
- Security features and validation
