const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class PrescriptionParsingAgent {
  constructor() {
    this.supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    this.medicationKeywords = [
      'tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler',
      'mg', 'ml', 'gm', 'g', 'once', 'twice', 'thrice', 'daily', 'weekly', 'monthly',
      'before', 'after', 'with', 'without', 'food', 'meal', 'empty', 'stomach',
      'morning', 'evening', 'night', 'bedtime', 'as', 'needed', 'prn'
    ];
  }

  /**
   * Parse prescription from uploaded file
   * @param {string} filePath - Path to the uploaded file
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<Object>} Parsed prescription data
   */
  async parsePrescription(filePath, mimeType) {
    try {
      console.log(`🔍 Starting prescription parsing for: ${filePath}`);
      
      // Extract text using OCR
      const extractedText = await this.extractTextFromFile(filePath, mimeType);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text could be extracted from the prescription');
      }

      // Parse the extracted text
      const parsedData = await this.parsePrescriptionText(extractedText);
      
      return {
        success: true,
        ocrText: extractedText,
        parsedData: parsedData,
        parsingStatus: 'completed'
      };

    } catch (error) {
      console.error('❌ Prescription parsing failed:', error);
      return {
        success: false,
        ocrText: '',
        parsedData: null,
        parsingStatus: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Extract text from file using OCR
   * @param {string} filePath - Path to the file
   * @param {string} mimeType - MIME type
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromFile(filePath, mimeType) {
    return new Promise((resolve, reject) => {
      try {
        // For now, we'll use a simple text extraction approach
        // In production, you'd use Tesseract.js or Google Vision API
        
        if (mimeType === 'application/pdf') {
          // For PDF files, we'll simulate text extraction
          this.simulatePDFTextExtraction(filePath)
            .then(resolve)
            .catch(reject);
        } else if (this.supportedFormats.includes(mimeType)) {
          // For image files, simulate OCR
          this.simulateImageOCR(filePath)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Unsupported file format: ${mimeType}`));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Simulate PDF text extraction (replace with actual PDF parsing library)
   */
  async simulatePDFTextExtraction(filePath) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return simulated prescription text
    return `Dr. John Smith
Medical Center
123 Health Street

Patient: Jane Doe
Date: ${new Date().toLocaleDateString()}

Prescription:
1. Paracetamol 500mg - 1 tablet twice daily after meals
2. Amoxicillin 250mg - 1 capsule three times daily
3. Cough syrup - 5ml as needed for cough

Follow up: 1 week
Special instructions: Take with plenty of water`;
  }

  /**
   * Simulate image OCR (replace with actual OCR library like Tesseract.js)
   */
  async simulateImageOCR(filePath) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Return simulated prescription text
    return `Dr. Sarah Johnson
Family Clinic
456 Wellness Ave

Patient: John Smith
Date: ${new Date().toLocaleDateString()}

Rx:
1. Ibuprofen 400mg - 1 tablet every 8 hours
2. Antibiotic cream - Apply twice daily
3. Vitamin D - 1 tablet daily

Return in 2 weeks if symptoms persist`;
  }

  /**
   * Parse prescription text to extract structured data
   * @param {string} text - Raw OCR text
   * @returns {Object} Structured prescription data
   */
  async parsePrescriptionText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const parsedData = {
      medications: [],
      doctorNotes: '',
      followUpDate: null,
      specialInstructions: ''
    };

    let currentSection = 'medications';
    let medicationIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      // Detect section changes
      if (line.includes('follow up') || line.includes('return') || line.includes('review')) {
        currentSection = 'followup';
        continue;
      }
      
      if (line.includes('special') || line.includes('note') || line.includes('instruction')) {
        currentSection = 'instructions';
        continue;
      }

      // Parse medications
      if (currentSection === 'medications' && this.isMedicationLine(line)) {
        const medication = this.parseMedicationLine(lines[i]);
        if (medication) {
          parsedData.medications.push(medication);
          medicationIndex++;
        }
      }
      
      // Parse follow-up date
      if (currentSection === 'followup') {
        const followUpDate = this.extractDate(lines[i]);
        if (followUpDate) {
          parsedData.followUpDate = followUpDate;
        }
      }
      
      // Parse special instructions
      if (currentSection === 'instructions') {
        parsedData.specialInstructions += lines[i] + ' ';
      }
    }

    // Extract doctor notes (usually at the beginning)
    const doctorNotes = lines.slice(0, 5).join(' ');
    parsedData.doctorNotes = doctorNotes;

    return parsedData;
  }

  /**
   * Check if a line contains medication information
   */
  isMedicationLine(line) {
    const lowerLine = line.toLowerCase();
    return this.medicationKeywords.some(keyword => lowerLine.includes(keyword)) ||
           /^\d+\./.test(line) || // Lines starting with numbers
           /\d+\s*(mg|ml|gm|g)/.test(line); // Contains dosage information
  }

  /**
   * Parse a single medication line
   */
  parseMedicationLine(line) {
    try {
      // Extract medication name (usually the first part)
      const parts = line.split(/[-–—]/);
      const medicationPart = parts[0].trim();
      
      // Extract dosage
      const dosageMatch = line.match(/(\d+\s*(mg|ml|gm|g|tablet|capsule|ml))/gi);
      const dosage = dosageMatch ? dosageMatch[0] : '';
      
      // Extract frequency
      const frequencyMatch = line.match(/(once|twice|thrice|\d+\s*times?)\s*(daily|weekly|monthly|hourly|day|week|month)/gi);
      const frequency = frequencyMatch ? frequencyMatch[0] : '';
      
      // Extract instructions
      const instructionKeywords = ['before', 'after', 'with', 'without', 'food', 'meal', 'empty', 'stomach'];
      const instructions = instructionKeywords
        .filter(keyword => line.toLowerCase().includes(keyword))
        .map(keyword => line.toLowerCase().split(keyword)[1]?.trim())
        .filter(Boolean)
        .join(', ');

      return {
        name: medicationPart,
        dosage: dosage,
        frequency: frequency,
        duration: this.extractDuration(line),
        instructions: instructions || line
      };
    } catch (error) {
      console.error('Error parsing medication line:', error);
      return null;
    }
  }

  /**
   * Extract duration from text
   */
  extractDuration(text) {
    const durationMatch = text.match(/(\d+\s*(day|week|month|year)s?)/gi);
    return durationMatch ? durationMatch[0] : '';
  }

  /**
   * Extract date from text
   */
  extractDate(text) {
    const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) {
      return new Date(dateMatch[1]);
    }
    return null;
  }

  /**
   * Validate parsed prescription data
   */
  validateParsedData(parsedData) {
    const errors = [];
    
    if (!parsedData.medications || parsedData.medications.length === 0) {
      errors.push('No medications found in prescription');
    }
    
    parsedData.medications.forEach((med, index) => {
      if (!med.name || med.name.trim().length === 0) {
        errors.push(`Medication ${index + 1}: Missing medication name`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = PrescriptionParsingAgent;
