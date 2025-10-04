require('dotenv').config();
const { connectDB } = require('../config/db');
const User = require('../models/User');

(async () => {
  try {
    await connectDB();
    const existing = await User.findOne({ role: 'PRINCIPAL' });
    if (existing) {
      console.log('Principal already exists:', existing.email);
      process.exit(0);
    }
    const admin = await User.create({
      name: 'Principal Admin',
      email: 'principal@campusflow.local',
      password: 'admin123',
      role: 'PRINCIPAL'
    });
    console.log('✅ Seeded Principal:', admin.email, '(password: admin123)');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
