# Health Portal - Syndromic Surveillance System

A comprehensive healthcare data management system with ML-powered syndromic surveillance capabilities.

## 📁 Project Structure

```
health-portal/
├── backend/                 # Node.js/Express.js Backend
│   ├── models/             # MongoDB Schemas
│   │   ├── Patient.js
│   │   ├── SymptomRecord.js
│   │   └── MLModel.js
│   ├── middleware/         # Express Middleware
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── validation.js
│   ├── routes/            # API Routes
│   │   ├── auth.js
│   │   ├── patients.js
│   │   └── ml.js
│   ├── services/          # Business Logic
│   │   └── mlService.js
│   ├── data/              # Training Data
│   │   └── sample_training_data.csv
│   ├── scripts/           # Utility Scripts
│   │   ├── seedData.js
│   │   └── trainModel.js
│   ├── server.js          # Main Server File
│   ├── package.json       # Dependencies
│   ├── .gitignore
│   └── env.example        # Environment Variables Template
├── frontend/              # Web Frontend
│   ├── public/
│   │   ├── index.html
│   │   ├── css/
│   │   │   └── style.css
│   │   ├── js/
│   │   │   └── app.js
│   │   └── test-login.html
├── database/              # Database Files
├── scripts/               # Project Scripts
│   └── start.sh
└── docs/                  # Documentation
    ├── README.md
    └── FRONTEND_README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. **Navigate to the backend directory:**
   ```bash
   cd ~/Desktop/health-portal/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your MongoDB connection string
   ```

4. **Start MongoDB:**
   ```bash
   brew services start mongodb-community
   ```

5. **Seed the database:**
   ```bash
   npm run seed
   ```

6. **Start the server:**
   ```bash
   npm start
   ```

7. **Open the frontend:**
   - Navigate to http://localhost:3000
   - Use the test login page: http://localhost:3000/test-login.html

## 🔐 Default Login Credentials

- **Email:** john.doe@example.com
- **Password:** SecurePass123!

## 🧠 ML Analysis Features

The system includes a sophisticated ML analysis engine that provides:

- **Real-time Risk Scoring:** 0-100% risk assessment
- **Syndrome Prediction:** Respiratory, Gastrointestinal, Cardiac, etc.
- **Confidence Levels:** AI confidence in predictions
- **Smart Recommendations:** Personalized care suggestions
- **Flagging System:** Automatic high-risk case identification

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh token

### Patient Management
- `GET /api/patients/dashboard` - Patient dashboard
- `POST /api/patients/symptoms` - Submit symptoms
- `GET /api/patients/symptoms` - Get symptom history

### ML Analysis
- `POST /api/ml/analyze` - Analyze symptoms
- `GET /api/ml/surveillance` - Surveillance data
- `GET /api/ml/trends` - Trend analysis

## 🛠️ Development

### Running in Development Mode
```bash
npm run dev
```

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## 📈 ML Model Training

To train a new ML model:
```bash
npm run train
```

## 🔧 Configuration

Key environment variables in `.env`:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## 📱 Frontend Features

- **Responsive Design:** Works on desktop and mobile
- **Real-time Updates:** Live ML analysis results
- **Interactive Dashboard:** Visual data representation
- **Symptom Reporting:** Easy-to-use forms
- **Analysis History:** Track previous assessments

## 🚨 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting
- CORS protection
- Helmet security headers

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support and questions, please contact the development team.

---

**Health Portal Team** - Building the future of healthcare surveillance
