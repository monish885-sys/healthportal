const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function resolvePythonBinary() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;

  const candidates = [
    path.join(__dirname, '..', '.venv', 'bin', 'python3'),
    path.join(__dirname, '..', 'venv', 'bin', 'python3'),
    'python3',
  ];

  for (const candidate of candidates) {
    if (candidate === 'python3' || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return 'python3';
}

const PYTHON_BIN = resolvePythonBinary();
const ML_CLI = path.join(__dirname, '..', 'ml_cli.py');

function runMlCommand(command, payload = {}) {
  return new Promise((resolve, reject) => {
    const input = JSON.stringify({ command, ...payload });
    const python = spawn(PYTHON_BIN, [ML_CLI], {
      cwd: path.join(__dirname, '..'),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    python.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    python.on('error', (err) => reject(err));

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `ML command failed with code ${code}`));
        return;
      }

      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        const jsonLine = lines.reverse().find((line) => line.startsWith('{') || line.startsWith('['));
        if (!jsonLine) {
          reject(new Error(`No JSON output from ML service. Output: ${stdout}`));
          return;
        }
        resolve(JSON.parse(jsonLine));
      } catch (err) {
        reject(new Error(`Failed to parse ML output: ${err.message}`));
      }
    });

    python.stdin.write(input);
    python.stdin.end();
  });
}

async function analyzeSymptoms(symptoms, { enrichPrecautions = false } = {}) {
  return runMlCommand('analyze', { symptoms, enrichPrecautions });
}

async function getAvailableSymptoms() {
  const result = await runMlCommand('symptoms');
  return Array.isArray(result) ? result : result.symptoms || [];
}

async function getDiseaseInfo(diseaseName) {
  return runMlCommand('disease_info', { diseaseName });
}

async function runConsultationBuddy({ symptoms, patientId, doctorId }) {
  return runMlCommand('consultation_buddy', { symptoms, patientId, doctorId });
}

module.exports = {
  analyzeSymptoms,
  getAvailableSymptoms,
  getDiseaseInfo,
  runConsultationBuddy,
};
