#!/usr/bin/env node
/**
 * Seed demo data for local development.
 * Usage: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../Models/user');
const Admin = require('../Models/admin');
const Doctor = require('../Models/doctor');
const Patient = require('../Models/patient');
const Appointment = require('../Models/appointment');

const dbURI = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/health-portal';

const doctors = [
  { did: 'd001', firstName: 'Doctor1', lastName: 'Demo', specialty: 'General Practice', email: 'doctor1@healthportal.com', password: 'doctor123', licenseNumber: 'LIC-D001' },
  { did: 'd002', firstName: 'Doctor2', lastName: 'Demo', specialty: 'Cardiology', email: 'doctor2@healthportal.com', password: 'doctor223', licenseNumber: 'LIC-D002' },
  { did: 'd003', firstName: 'Doctor3', lastName: 'Demo', specialty: 'Pediatrics', email: 'doctor3@healthportal.com', password: 'doctor323', licenseNumber: 'LIC-D003' },
  { did: 'd004', firstName: 'Doctor4', lastName: 'Demo', specialty: 'Dermatology', email: 'doctor4@healthportal.com', password: 'doctor423', licenseNumber: 'LIC-D004' },
];

const patients = [
  { pid: 'p001', firstName: 'Patient1', lastName: 'Demo', email: 'patient1@healthportal.com', password: 'patient123' },
  { pid: 'p002', firstName: 'Patient2', lastName: 'Demo', email: 'patient2@healthportal.com', password: 'patient223' },
  { pid: 'p003', firstName: 'Patient3', lastName: 'Demo', email: 'patient3@healthportal.com', password: 'patient323' },
  { pid: 'p004', firstName: 'Patient4', lastName: 'Demo', email: 'patient4@healthportal.com', password: 'patient423' },
  { pid: 'p005', firstName: 'Patient5', lastName: 'Demo', email: 'patient5@healthportal.com', password: 'patient523' },
  { pid: 'p006', firstName: 'Patient6', lastName: 'Demo', email: 'patient6@healthportal.com', password: 'patient623' },
  { pid: 'p007', firstName: 'Patient7', lastName: 'Demo', email: 'patient7@healthportal.com', password: 'patient723' },
  { pid: 'p008', firstName: 'Patient8', lastName: 'Demo', email: 'patient8@healthportal.com', password: 'patient823' },
];

const appointmentMatrix = [
  { patientPid: 'p001', doctorDid: 'd001', date: '2026-02-13', time: '09:00', reason: 'Routine consultation for Patient1' },
  { patientPid: 'p006', doctorDid: 'd002', date: '2026-02-13', time: '16:00', reason: 'Routine consultation for Patient6' },
  { patientPid: 'p002', doctorDid: 'd002', date: '2026-02-14', time: '10:00', reason: 'Routine consultation for Patient2' },
  { patientPid: 'p007', doctorDid: 'd003', date: '2026-02-14', time: '09:00', reason: 'Routine consultation for Patient7' },
  { patientPid: 'p003', doctorDid: 'd003', date: '2026-02-15', time: '11:00', reason: 'Routine consultation for Patient3' },
  { patientPid: 'p008', doctorDid: 'd004', date: '2026-02-15', time: '10:00', reason: 'Routine consultation for Patient8' },
  { patientPid: 'p004', doctorDid: 'd004', date: '2026-02-16', time: '14:00', reason: 'Routine consultation for Patient4' },
  { patientPid: 'p005', doctorDid: 'd001', date: '2026-02-17', time: '15:00', reason: 'Routine consultation for Patient5' },
];

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    Admin.deleteMany({}),
    Doctor.deleteMany({}),
    Patient.deleteMany({}),
    Appointment.deleteMany({}),
  ]);
}

async function seed() {
  await mongoose.connect(dbURI);
  console.log('Connected to MongoDB');

  await clearCollections();
  console.log('Cleared existing demo data');

  const adminPassword = await hashPassword('admin123');
  await Admin.create({ email: 'admin@healthportal.com', password: adminPassword });
  console.log('Created admin: admin@healthportal.com / admin123');

  const doctorProfiles = {};
  for (const doc of doctors) {
    const user = await User.create({
      email: doc.email,
      password: await hashPassword(doc.password),
      role: 'doctor',
      status: 'active',
    });

    const profile = await Doctor.create({
      userId: user._id,
      did: doc.did,
      firstName: doc.firstName,
      lastName: doc.lastName,
      specialty: doc.specialty,
      contactNumber: '15550001001',
      licenseNumber: doc.licenseNumber,
      experience: 8,
      education: { degree: 'MD', institution: 'Demo Medical College', graduationYear: 2012 },
      availability: 'Full-time',
      status: 'active',
    });
    doctorProfiles[doc.did] = profile;
    console.log(`Created doctor: ${doc.email}`);
  }

  const patientProfiles = {};
  for (const pat of patients) {
    const user = await User.create({
      email: pat.email,
      password: await hashPassword(pat.password),
      role: 'patient',
      status: 'active',
    });

    const profile = await Patient.create({
      userId: user._id,
      pid: pat.pid,
      firstName: pat.firstName,
      lastName: pat.lastName,
      dateOfBirth: new Date('1990-01-15'),
      contactNumber: '15550002002',
      gender: 'Other',
      bloodType: 'O+',
      emergencyContact: { name: 'Emergency Contact', relationship: 'Sibling', phone: '15550002003' },
      address: { street: '123 Demo St', city: 'Demo City', state: 'CA', zipCode: '94105' },
      status: 'active',
    });
    patientProfiles[pat.pid] = profile;
    console.log(`Created patient: ${pat.email}`);
  }

  for (const appt of appointmentMatrix) {
    await Appointment.create({
      patientId: patientProfiles[appt.patientPid]._id,
      doctorId: doctorProfiles[appt.doctorDid]._id,
      date: new Date(appt.date),
      time: appt.time,
      reason: appt.reason,
      status: 'scheduled',
    });
  }
  console.log(`Created ${appointmentMatrix.length} appointments`);

  console.log('\nSeed complete. See DEMO_USERS.md for credentials.');
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
