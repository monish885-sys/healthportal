# Demo Users And Fixed Schedule Matrix

This environment is seeded with **only**:
- 1 Admin
- 4 Doctors
- 8 Patients

## Credentials

### Admin
| Role | Email | Password |
|---|---|---|
| Admin | `admin@healthportal.com` | `admin123` |

### Doctors
| DID | Name | Specialty | Email | Password |
|---|---|---|---|---|
| d001 | Doctor1 Demo | General Practice | `doctor1@healthportal.com` | `doctor123` |
| d002 | Doctor2 Demo | Cardiology | `doctor2@healthportal.com` | `doctor223` |
| d003 | Doctor3 Demo | Pediatrics | `doctor3@healthportal.com` | `doctor323` |
| d004 | Doctor4 Demo | Dermatology | `doctor4@healthportal.com` | `doctor423` |

### Patients
| PID | Name | Email | Password |
|---|---|---|---|
| p001 | Patient1 Demo | `patient1@healthportal.com` | `patient123` |
| p002 | Patient2 Demo | `patient2@healthportal.com` | `patient223` |
| p003 | Patient3 Demo | `patient3@healthportal.com` | `patient323` |
| p004 | Patient4 Demo | `patient4@healthportal.com` | `patient423` |
| p005 | Patient5 Demo | `patient5@healthportal.com` | `patient523` |
| p006 | Patient6 Demo | `patient6@healthportal.com` | `patient623` |
| p007 | Patient7 Demo | `patient7@healthportal.com` | `patient723` |
| p008 | Patient8 Demo | `patient8@healthportal.com` | `patient823` |

## Fixed Appointment Schedule Matrix

| PID | Patient | DID | Doctor | Specialty | Date | Time | Status | Reason |
|---|---|---|---|---|---|---|---|---|
| p001 | Patient1 Demo | d001 | Dr. Doctor1 Demo | General Practice | 2026-02-13 | 09:00 | scheduled | Routine consultation for Patient1 |
| p006 | Patient6 Demo | d002 | Dr. Doctor2 Demo | Cardiology | 2026-02-13 | 16:00 | scheduled | Routine consultation for Patient6 |
| p002 | Patient2 Demo | d002 | Dr. Doctor2 Demo | Cardiology | 2026-02-14 | 10:00 | scheduled | Routine consultation for Patient2 |
| p007 | Patient7 Demo | d003 | Dr. Doctor3 Demo | Pediatrics | 2026-02-14 | 09:00 | scheduled | Routine consultation for Patient7 |
| p003 | Patient3 Demo | d003 | Dr. Doctor3 Demo | Pediatrics | 2026-02-15 | 11:00 | scheduled | Routine consultation for Patient3 |
| p008 | Patient8 Demo | d004 | Dr. Doctor4 Demo | Dermatology | 2026-02-15 | 10:00 | scheduled | Routine consultation for Patient8 |
| p004 | Patient4 Demo | d004 | Dr. Doctor4 Demo | Dermatology | 2026-02-16 | 14:00 | scheduled | Routine consultation for Patient4 |
| p005 | Patient5 Demo | d001 | Dr. Doctor1 Demo | General Practice | 2026-02-17 | 15:00 | scheduled | Routine consultation for Patient5 |
