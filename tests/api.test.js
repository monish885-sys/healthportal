process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');
const app = require('../app');
const User = require('../Models/user');
const Admin = require('../Models/admin');
const Patient = require('../Models/patient');

let mongoServer;
let agent;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  agent = request.agent(app);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

async function createPatient(email = 'patient@test.com', password = 'patient123') {
  const user = await User.create({
    email,
    password: await bcrypt.hash(password, 10),
    role: 'patient',
    status: 'active',
  });

  const patient = await Patient.create({
    userId: user._id,
    pid: 'p001',
    firstName: 'Test',
    lastName: 'Patient',
    dateOfBirth: new Date('1990-05-01'),
    contactNumber: '15551234567',
    gender: 'Other',
    bloodType: 'O+',
    emergencyContact: { name: 'EC', relationship: 'Friend', phone: '15559876543' },
    address: { street: '1 Test St', city: 'Testville', state: 'CA', zipCode: '90210' },
    status: 'active',
  });

  return { user, patient };
}

describe('Health Portal API', () => {
  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  test('GET /api/docs returns documentation', async () => {
    const res = await request(app).get('/api/docs');
    assert.equal(res.status, 200);
    assert.ok(res.body.auth);
  });

  test('POST /api/auth/login rejects invalid credentials', async () => {
    await createPatient();
    const res = await agent
      .post('/api/auth/login')
      .send({ email: 'patient@test.com', password: 'wrong', role: 'patient' });
    assert.equal(res.status, 400);
  });

  test('POST /api/auth/login succeeds for patient', async () => {
    await createPatient();
    const res = await agent
      .post('/api/auth/login')
      .send({ email: 'patient@test.com', password: 'patient123', role: 'patient' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'patient');
  });

  test('GET /api/healthcare/appointments requires auth', async () => {
    const res = await request(app).get('/api/healthcare/appointments');
    assert.equal(res.status, 401);
  });

  test('POST /api/auth/register is blocked outside development', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'new@test.com',
        password: 'password1',
        role: 'patient',
        firstName: 'New',
        lastName: 'User',
      });
    assert.equal(res.status, 403);
  });

  test('admin login works with seeded admin', async () => {
    await Admin.create({
      email: 'admin@test.com',
      password: await bcrypt.hash('admin123', 10),
    });

    const res = await agent
      .post('/api/admin/login')
      .send({ email: 'admin@test.com', password: 'admin123' });
    assert.equal(res.status, 200);

    const stats = await agent.get('/api/admin/stats');
    assert.equal(stats.status, 200);
    assert.ok(stats.body.totalUsers !== undefined);
  });
});
