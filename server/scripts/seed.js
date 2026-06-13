/**
 * Seed script — creates demo agent + admin accounts
 * Run once: node scripts/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { initDB } = require('../config/db');
const userModel = require('../models/user.model');
const bcrypt = require('bcryptjs');

async function seed() {
  initDB();
  const accounts = [
    { name: 'Demo Agent', email: 'agent@demo.com', password: 'demo1234', role: 'agent' },
    { name: 'Demo Admin', email: 'admin@demo.com', password: 'admin1234', role: 'admin' },
  ];

  for (const acc of accounts) {
    const existing = userModel.findByEmail(acc.email);
    if (existing) {
      console.log(`✓ Already exists: ${acc.email}`);
      continue;
    }
    const passwordHash = await bcrypt.hash(acc.password, 12);
    userModel.create({ name: acc.name, email: acc.email, passwordHash, role: acc.role });
    console.log(`✓ Created: ${acc.email} (${acc.role})`);
  }
  console.log('\n✅ Seed complete');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
