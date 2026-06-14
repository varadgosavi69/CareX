// Idempotent doctor seed. Creates ~10 approved doctors (User + Doctor) spread
// around Nagpur so the directory and map look populated. Run:  npm run seed:doctors
//
// Safe to re-run: doctors are matched by email and updated in place (no dupes).
// Passwords go through user.save() so the model's bcrypt pre-save hook runs —
// we never bypass hashing with insertMany.

import { env } from '../config/env.js'; // loads + validates env (dotenv)
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import logger from '../utils/logger.js';
import { ROLES, DOCTOR_STATUS } from '../utils/constants.js';

// Shared password for every seeded doctor (use to log into the DoctorPanel).
const TEST_PASSWORD = 'Doctor@123';

// Nagpur city centre; each doctor is offset slightly so pins don't overlap.
const CITY = { lat: 21.1458, lng: 79.0882 };

// A weekday morning clinic and an afternoon clinic, reused across doctors.
const MORNINGS = (days) => days.map((day) => ({ day, startTime: '09:00', endTime: '13:00' }));
const EVENINGS = (days) => days.map((day) => ({ day, startTime: '15:00', endTime: '19:00' }));

// name, email, specialty, qualifications, experienceYears, fee, availability, offset, address
const DOCTORS = [
  {
    name: 'Dr. Arjun Deshmukh', email: 'arjun.cardio@carex.test', specialty: 'Cardiology',
    qualifications: 'MBBS, MD, DM (Cardiology)', experienceYears: 14, consultationFee: 800,
    availability: MORNINGS(['Monday', 'Wednesday', 'Friday']),
    offset: { lat: 0.012, lng: 0.008 }, address: 'Dhantoli, Nagpur',
  },
  {
    name: 'Dr. Priya Kulkarni', email: 'priya.derma@carex.test', specialty: 'Dermatology',
    qualifications: 'MBBS, MD (Dermatology)', experienceYears: 9, consultationFee: 600,
    availability: EVENINGS(['Monday', 'Tuesday', 'Thursday']),
    offset: { lat: -0.009, lng: 0.011 }, address: 'Sadar, Nagpur',
  },
  {
    name: 'Dr. Rahul Mehta', email: 'rahul.pedia@carex.test', specialty: 'Pediatrics',
    qualifications: 'MBBS, MD (Pediatrics)', experienceYears: 11, consultationFee: 500,
    availability: MORNINGS(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
    offset: { lat: 0.006, lng: -0.013 }, address: 'Ramdaspeth, Nagpur',
  },
  {
    name: 'Dr. Sneha Joshi', email: 'sneha.ortho@carex.test', specialty: 'Orthopedics',
    qualifications: 'MBBS, MS (Orthopedics)', experienceYears: 16, consultationFee: 700,
    availability: MORNINGS(['Tuesday', 'Thursday', 'Saturday']),
    offset: { lat: -0.014, lng: -0.006 }, address: 'Wardha Road, Nagpur',
  },
  {
    name: 'Dr. Vikram Rao', email: 'vikram.gp@carex.test', specialty: 'General Physician',
    qualifications: 'MBBS, MD (General Medicine)', experienceYears: 7, consultationFee: 400,
    availability: [...MORNINGS(['Monday', 'Wednesday', 'Friday']), ...EVENINGS(['Tuesday', 'Thursday'])],
    offset: { lat: 0.003, lng: 0.004 }, address: 'Sitabuldi, Nagpur',
  },
  {
    name: 'Dr. Anjali Nair', email: 'anjali.ent@carex.test', specialty: 'ENT',
    qualifications: 'MBBS, MS (ENT)', experienceYears: 10, consultationFee: 550,
    availability: EVENINGS(['Monday', 'Wednesday', 'Friday']),
    offset: { lat: 0.016, lng: -0.004 }, address: 'Civil Lines, Nagpur',
  },
  {
    name: 'Dr. Meera Pillai', email: 'meera.gynec@carex.test', specialty: 'Gynecology',
    qualifications: 'MBBS, MD, DGO', experienceYears: 18, consultationFee: 750,
    availability: MORNINGS(['Monday', 'Tuesday', 'Thursday', 'Saturday']),
    offset: { lat: -0.005, lng: 0.015 }, address: 'Manish Nagar, Nagpur',
  },
  {
    name: 'Dr. Siddharth Jain', email: 'siddharth.neuro@carex.test', specialty: 'Neurology',
    qualifications: 'MBBS, MD, DM (Neurology)', experienceYears: 13, consultationFee: 900,
    availability: EVENINGS(['Tuesday', 'Thursday']),
    offset: { lat: 0.010, lng: 0.013 }, address: 'Pratap Nagar, Nagpur',
  },
  {
    name: 'Dr. Kavita Shah', email: 'kavita.psych@carex.test', specialty: 'Psychiatry',
    qualifications: 'MBBS, MD (Psychiatry)', experienceYears: 8, consultationFee: 650,
    availability: EVENINGS(['Monday', 'Wednesday', 'Friday']),
    offset: { lat: -0.011, lng: -0.012 }, address: 'Bajaj Nagar, Nagpur',
  },
  {
    name: 'Dr. Rohan Gupta', email: 'rohan.dental@carex.test', specialty: 'Dentistry',
    qualifications: 'BDS, MDS', experienceYears: 6, consultationFee: 450,
    availability: [...MORNINGS(['Monday', 'Wednesday']), ...EVENINGS(['Friday'])],
    offset: { lat: 0.008, lng: -0.009 }, address: 'Trimurti Nagar, Nagpur',
  },
];

const run = async () => {
  await connectDB();

  for (const def of DOCTORS) {
    const email = def.email.toLowerCase().trim();

    // Upsert the User (role=doctor). Always (re)set the password through save()
    // so the bcrypt pre-save hook hashes it and the known test password works.
    let user = await User.findOne({ email }).select('+password');
    if (!user) {
      user = new User({ name: def.name, email, password: TEST_PASSWORD, role: ROLES.DOCTOR });
    } else {
      user.name = def.name;
      user.role = ROLES.DOCTOR;
      user.password = TEST_PASSWORD;
    }
    await user.save();

    // Upsert the Doctor profile (matched by user).
    const doctorData = {
      specialty: def.specialty,
      qualifications: def.qualifications,
      experienceYears: def.experienceYears,
      consultationFee: def.consultationFee,
      availability: def.availability,
      status: DOCTOR_STATUS.APPROVED,
      location: {
        type: 'Point',
        coordinates: [CITY.lng + def.offset.lng, CITY.lat + def.offset.lat], // [lng, lat]
        address: def.address,
      },
    };

    let doctor = await Doctor.findOne({ user: user._id });
    if (doctor) {
      Object.assign(doctor, doctorData);
      await doctor.save();
    } else {
      doctor = await Doctor.create({ user: user._id, ...doctorData });
    }
  }

  logger.info(`Seeded ${DOCTORS.length} approved doctors.`);

  // Print credentials (logger is silent in non-relevant envs; use console here
  // intentionally so the operator sees the logins after running the seed).
  // eslint-disable-next-line no-console
  console.log('\n──────── Seeded doctor logins ────────');
  // eslint-disable-next-line no-console
  console.log(`Shared password: ${TEST_PASSWORD}\n`);
  for (const def of DOCTORS) {
    // eslint-disable-next-line no-console
    console.log(`  ${def.specialty.padEnd(18)} ${def.email}`);
  }
  // eslint-disable-next-line no-console
  console.log('──────────────────────────────────────\n');

  await disconnectDB();
  process.exit(0);
};

run().catch((err) => {
  logger.error(`Doctor seed failed: ${err.message}`);
  process.exit(1);
});
