require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const adminRoutes = require('./routes/adminRoutes');
const adminDiseaseRoutes = require('./routes/adminDiseaseRoutes');
const authRoutes = require('./routes/authRoutes');
const healthcareRoutes = require('./routes/healthcareRoutes');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && !sessionSecret) {
  throw new Error('SESSION_SECRET must be set in production');
}

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || false,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10),
  message: { msg: 'Too many authentication attempts, please try again later' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/admin/login', authLimiter);

const sessionsDir = path.join(__dirname, 'sessions');
app.use(session({
  store: new FileStore({ path: sessionsDir, ttl: 86400, retries: 0 }),
  secret: sessionSecret || 'dev-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'hp.sid',
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

const portalPages = [
  ['/', 'index.html'],
  ['/admin', 'admin.html'],
  ['/doctor', 'doctor.html'],
  ['/patient', 'patient.html'],
  ['/patient-login', 'patient-login.html'],
  ['/admin-login', 'admin-login.html'],
  ['/doctor-login', 'doctor-login.html'],
  ['/set-password', 'set-password.html'],
];

portalPages.forEach(([route, file]) => {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/admin', adminRoutes);
app.use('/api/admin/disease', adminDiseaseRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/healthcare', healthcareRoutes);

app.get('/api', (_req, res) => {
  res.json({
    message: 'Welcome to the Health Portal API',
    version: '3.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      adminDisease: '/api/admin/disease',
      healthcare: '/api/healthcare',
      health: '/api/health',
    },
  });
});

app.get('/api/docs', (_req, res) => {
  res.json({
    auth: {
      'POST /api/auth/login': 'Login with email, password, role',
      'POST /api/auth/logout': 'Logout current session',
      'GET /api/auth/me': 'Current session user',
      'POST /api/auth/set-password': 'Set password via reset token',
    },
    healthcare: {
      'GET/POST /api/healthcare/appointments': 'List or create appointments',
      'GET/POST /api/healthcare/prescriptions': 'List or create prescriptions',
      'POST /api/healthcare/symptom-analysis': 'Run ML symptom analysis',
      'GET /api/healthcare/outbreak-alerts': 'Patient-safe outbreak notifications',
    },
    admin: {
      'POST /api/admin/login': 'Admin login',
      'POST /api/admin/create-user': 'Create doctor or patient',
      'GET /api/admin/disease/disease-stats': 'Disease analytics',
    },
  });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ msg: 'Invalid JSON payload' });
  }
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ msg: err.message });
  }
  return next(err);
});

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    msg: 'Something went wrong',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

app.use((_req, res) => {
  res.status(404).json({ msg: 'Route not found' });
});

module.exports = app;
