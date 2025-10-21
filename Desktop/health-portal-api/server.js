require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

const adminRoutes = require('./routes/adminRoutes');
const adminDiseaseRoutes = require('./routes/adminDiseaseRoutes');
const authRoutes = require('./routes/authRoutes');
const healthcareRoutes = require('./routes/healthcareRoutes');
const fileRoutes = require('./routes/fileRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Session configuration
app.use(session({
  store: new FileStore({ path: './sessions' }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Database connection
const dbURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/health-portal';
mongoose.connect(dbURI)
.then(() => {
  console.log('✅ Connected to MongoDB successfully.');
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📱 Health Portal: http://localhost:${PORT}`);
    console.log(`🔐 Admin Portal: http://localhost:${PORT}/admin`);
    console.log(`👨‍⚕️ Doctor Portal: http://localhost:${PORT}/doctor`);
    console.log(`🏥 Patient Portal: http://localhost:${PORT}/patient`);
    console.log(`🌐 API Base: http://localhost:${PORT}/api`);
  });
})
.catch((error) => {
  console.error('❌ Database connection error:', error);
  process.exit(1);
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/disease', adminDiseaseRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/healthcare', healthcareRoutes);
app.use('/api/healthcare', fileRoutes);
app.use('/api/healthcare', prescriptionRoutes);

// Serve main portal page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve role-specific portals
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/doctor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doctor.html'));
});

app.get('/patient', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient.html'));
});

app.get('/patient-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient-login.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to the Health Portal API!',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      adminDisease: '/api/admin/disease',
      healthcare: '/api/healthcare',
      docs: 'Coming soon...'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});