# Health Portal Frontend

A modern, responsive web interface for the Health Portal API that provides real-time syndromic surveillance and health data management.

## 🌟 Features

### 🏠 **Home Page**
- Welcome screen with feature overview
- Call-to-action buttons for login and surveillance
- Responsive design with modern UI

### 🔐 **Authentication**
- **Login**: Secure JWT-based authentication
- **Registration**: Complete patient registration form
- **Session Management**: Persistent login with localStorage

### 📊 **Patient Dashboard**
- Recent symptoms overview
- Health statistics and metrics
- Quick action buttons
- Real-time data updates

### 🩺 **Symptom Reporting**
- **Multi-symptom Entry**: Add multiple symptoms with severity and duration
- **Vital Signs**: Optional temperature, heart rate, blood pressure, etc.
- **Additional Info**: Travel history, exposure, medications
- **Location Data**: ZIP code, city, state for surveillance
- **Real-time Analysis**: Instant ML-powered risk assessment

### 📈 **Surveillance Dashboard**
- **Risk Distribution**: Visual overview of risk levels
- **Syndrome Trends**: Analysis of predicted syndromes
- **Geographic Distribution**: Location-based health data
- **Recent Cases Table**: Detailed case information
- **Filtering**: Date range and location filters

## 🚀 Quick Start

### Option 1: Using the Start Script
```bash
# Make sure you're in the project directory
cd /Users/monishbalusu

# Run the complete startup script
./start.sh
```

### Option 2: Manual Start
```bash
# Start MongoDB (if not running)
brew services start mongodb-community

# Start the server
npm start

# Open browser
open http://localhost:3000
```

## 🎯 Usage Guide

### 1. **Access the Application**
- Open your browser and go to `http://localhost:3000`
- You'll see the Health Portal home page

### 2. **Login or Register**
- Click "Get Started" to access the login form
- Use test credentials:
  - **Email**: `john.doe@example.com`
  - **Password**: `SecurePass123!`
- Or register a new account

### 3. **Report Symptoms**
- After logging in, click "Report Symptoms"
- Add one or more symptoms with:
  - Symptom name (e.g., fever, headache, cough)
  - Severity level (1-10 scale)
  - Duration (minutes, hours, days, weeks)
  - Optional description
- Fill in vital signs if available
- Add location information
- Submit for AI analysis

### 4. **View Analysis Results**
- After submitting symptoms, you'll see:
  - **Risk Score**: Percentage risk assessment
  - **Predicted Syndrome**: AI-predicted condition
  - **Confidence Level**: Analysis confidence
  - **Recommendations**: Personalized health advice
  - **Flag Status**: Whether manual review is needed

### 5. **Monitor Dashboard**
- View recent symptoms and health statistics
- Track your health trends over time
- Access quick actions for reporting

### 6. **Surveillance Data**
- Click "Surveillance" to view public health data
- See risk distribution and syndrome trends
- Analyze geographic health patterns
- Review recent cases (anonymized)

## 🎨 UI Components

### **Responsive Design**
- Mobile-first approach
- Hamburger menu for mobile devices
- Flexible grid layouts
- Touch-friendly interface

### **Color Coding**
- **High Risk**: Red (#dc3545)
- **Medium Risk**: Yellow (#ffc107)
- **Low Risk**: Green (#28a745)
- **Primary**: Blue gradient (#667eea to #764ba2)

### **Interactive Elements**
- Hover effects on buttons and cards
- Smooth transitions and animations
- Loading overlays for async operations
- Modal dialogs for alerts and confirmations

## 🔧 Technical Details

### **Frontend Stack**
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with Flexbox and Grid
- **Vanilla JavaScript**: No frameworks, pure JS
- **Font Awesome**: Icons
- **Responsive Design**: Mobile-first approach

### **API Integration**
- RESTful API calls to backend
- JWT token authentication
- Error handling and user feedback
- Real-time data updates

### **Browser Support**
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 📱 Mobile Experience

The frontend is fully responsive and optimized for mobile devices:

- **Touch-friendly**: Large buttons and touch targets
- **Hamburger Menu**: Collapsible navigation
- **Responsive Forms**: Optimized for mobile input
- **Swipe Gestures**: Natural mobile interactions
- **Fast Loading**: Optimized assets and code

## 🛠️ Development

### **File Structure**
```
public/
├── index.html          # Main HTML file
├── css/
│   └── style.css       # All styles
├── js/
│   └── app.js          # All JavaScript functionality
└── images/             # Static images (if any)
```

### **Key Functions**
- `initializeApp()`: App initialization
- `handleLogin()`: Authentication
- `handleSymptomsSubmit()`: Symptom reporting
- `loadDashboard()`: Dashboard data
- `loadSurveillanceData()`: Surveillance data
- `showAnalysisResults()`: Display ML results

### **API Endpoints Used**
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/patients/dashboard` - Dashboard data
- `POST /api/patients/symptoms` - Submit symptoms
- `GET /api/ml/surveillance` - Surveillance data

## 🎯 User Workflows

### **New User Flow**
1. Visit homepage
2. Click "Get Started"
3. Register new account
4. Login with credentials
5. Report symptoms
6. View analysis results
7. Monitor dashboard

### **Returning User Flow**
1. Visit homepage
2. Click "Get Started"
3. Login with existing credentials
4. View dashboard
5. Report new symptoms
6. Check surveillance data

### **Surveillance Flow**
1. Visit homepage
2. Click "View Surveillance"
3. Browse public health data
4. Apply filters (date, location)
5. Analyze trends and patterns

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Input Validation**: Client-side validation
- **XSS Protection**: Sanitized user input
- **HTTPS Ready**: Secure communication
- **Session Management**: Automatic logout

## 🚀 Performance

- **Fast Loading**: Optimized assets
- **Lazy Loading**: On-demand data loading
- **Caching**: Local storage for auth
- **Minimal Dependencies**: Lightweight code
- **Responsive Images**: Optimized media

## 🐛 Troubleshooting

### **Common Issues**

1. **Server Not Running**
   - Check if MongoDB is running: `brew services list | grep mongodb`
   - Start server: `npm start`
   - Check port 3000: `lsof -i :3000`

2. **Login Issues**
   - Use test credentials: `john.doe@example.com` / `SecurePass123!`
   - Check browser console for errors
   - Clear localStorage and try again

3. **API Errors**
   - Check server logs
   - Verify API endpoints are responding
   - Check network tab in browser dev tools

4. **Mobile Issues**
   - Ensure responsive design is working
   - Check viewport meta tag
   - Test on different screen sizes

### **Debug Mode**
- Open browser developer tools (F12)
- Check Console tab for JavaScript errors
- Check Network tab for API call issues
- Check Application tab for localStorage

## 📞 Support

For technical support or questions:
- Check the main README.md for API documentation
- Review browser console for error messages
- Verify server is running and accessible
- Test with provided sample data

## 🎉 Success!

You now have a fully functional Health Portal with:
- ✅ Modern, responsive frontend
- ✅ Real-time ML analysis
- ✅ Comprehensive surveillance dashboard
- ✅ Secure authentication
- ✅ Mobile-optimized interface

The application is ready for production use and can be easily extended with additional features!
