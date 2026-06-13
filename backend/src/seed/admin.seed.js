// Idempotent admin seed. Creates (or updates) a single admin user from
// ADMIN_EMAIL / ADMIN_PASSWORD. Run once after deploy:  npm run seed:admin
//
// Safe to re-run: if the admin already exists it ensures the role is `admin`
// and resets the password to the configured value.

import { env } from '../config/env.js'; // loads + validates env (dotenv)
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { ROLES } from '../utils/constants.js';

const run = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    logger.error('Seed aborted: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  await connectDB();

  const normalizedEmail = email.toLowerCase().trim();
  let admin = await User.findOne({ email: normalizedEmail }).select('+password');

  if (admin) {
    admin.role = ROLES.ADMIN;
    admin.password = password; // pre-save hook re-hashes
    await admin.save();
    logger.info(`Admin user updated: ${normalizedEmail}`);
  } else {
    admin = await User.create({
      name: 'Administrator',
      email: normalizedEmail,
      password,
      role: ROLES.ADMIN,
    });
    logger.info(`Admin user created: ${normalizedEmail}`);
  }

  await disconnectDB();
  process.exit(0);
};

run().catch((err) => {
  logger.error(`Admin seed failed: ${err.message}`);
  process.exit(1);
});
