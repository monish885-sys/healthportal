# Health Portal Setup Guide

## 🎯 Quick Start (5 minutes)

### Step 1: Prerequisites
Make sure you have these installed:
- **Node.js** (v14 or higher): [Download here](https://nodejs.org/)
- **MongoDB**: Install via Homebrew: `brew install mongodb-community`
- **Git**: For version control

### Step 2: Start the Application
```bash
# Navigate to the project directory
cd ~/Desktop/health-portal

# Run the startup script
./scripts/start.sh
```

That's it! The application will:
- Install all dependencies
- Start MongoDB
- Seed the database with sample data
- Start the web server
- Open the frontend in your browser

## 🔧 Manual Setup (if needed)

### Backend Setup
```bash
cd ~/Desktop/health-portal/backend

# Install dependencies
npm install

# Set up environment variables
cp env.example .env

# Start MongoDB
brew services start mongodb-community

# Seed database
npm run seed

# Start server
npm start
```

### Frontend Access
- **Main App**: http://localhost:3000
- **Test Login**: http://localhost:3000/test-login.html

## 🔐 Login Credentials

**Default User:**
- Email: `john.doe@example.com`
- Password: `SecurePass123!`

## 📱 Using the Application

### 1. Login
- Go to http://localhost:3000
- Click "Login" in the navigation
- Enter the credentials above

### 2. Report Symptoms
- Click "Report Symptoms" after logging in
- Fill out the symptom form
- Submit to see real-time ML analysis

### 3. View Dashboard
- See your symptom history
- View ML analysis results
- Check risk scores and recommendations

### 4. Test ML Analysis
- Use the test page: http://localhost:3000/test-login.html
- Pre-filled with correct credentials
- See detailed analysis results

## 🧠 ML Analysis Features

The system provides:
- **Risk Scoring**: 0-100% risk assessment
- **Syndrome Prediction**: Respiratory, Gastrointestinal, Cardiac, etc.
- **Confidence Levels**: AI confidence in predictions
- **Smart Recommendations**: Personalized care suggestions
- **Real-time Analysis**: Instant results

## 🛠️ Development

### Running in Development Mode
```bash
cd ~/Desktop/health-portal/backend
npm run dev
```

### Testing the API
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john.doe@example.com", "password": "SecurePass123!"}'
```

### Database Management
```bash
# Seed database
npm run seed

# Train ML model
npm run train
```

## 📊 Project Structure

```
health-portal/
├── backend/          # Node.js/Express.js API
├── frontend/         # Web interface
├── database/         # Database files
├── scripts/          # Utility scripts
└── docs/            # Documentation
```

## 🚨 Troubleshooting

### Port Already in Use
```bash
# Kill existing processes
pkill -f "node server.js"
# Then restart
./scripts/start.sh
```

### MongoDB Issues
```bash
# Restart MongoDB
brew services restart mongodb-community

# Check if running
brew services list | grep mongodb
```

### Permission Issues
```bash
# Make scripts executable
chmod +x scripts/start.sh
```

### Dependencies Issues
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📈 Next Steps

1. **Explore the API**: Check out the API documentation
2. **Customize the ML Model**: Modify the analysis rules
3. **Add New Features**: Extend the functionality
4. **Deploy**: Set up for production use

## 🆘 Support

If you encounter any issues:
1. Check the console output for error messages
2. Verify all prerequisites are installed
3. Ensure MongoDB is running
4. Check that port 3000 is available

## 🎉 Success!

Once everything is running, you should see:
- Server running on port 3000
- Frontend accessible in browser
- ML analysis working with detailed terminal output
- Sample data loaded in database

Enjoy exploring the Health Portal! 🏥✨
