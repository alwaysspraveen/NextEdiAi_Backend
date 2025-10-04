/**
 * seed_students_by_class.js
 * Creates 10 students for each of the 10 classes (1st–10th Std).
 *
 * Usage:
 *   MONGODB_URI="mongodb://127.0.0.1:27017/AssetHelpDB" node seed_students_by_class.js
 *
 * Notes:
 * - Uses User.create() per document, so your pre('save') hashing runs.
 * - Updates Classroom.students[] if models/Classroom exists (optional).
 * - Emails are unique per-tenant by adding grade+roll+suffix.
 */

const mongoose = require('mongoose');
const path = require('path');

// 🔧 Adjust paths if your models are elsewhere
const User = require('./src/models/User');
let Classroom = null;
try {
  Classroom = require(path.join(process.cwd(), 'models', 'Classroom'));
} catch {
  console.warn('Classroom model not found; will skip pushing students into classroom.students[]');
}

const DOMAIN = 'schoolmail.in';
const DEFAULT_PASSWORD = 'Temp@12345';

const CLASS_DOCS = [
  { _id: '68b8439b38380d2d18096e66', name: '1st Std', section: 'A', tenant: '68adb289f748039c5a58ab32', academicYear: '2025-2026' },
  { _id: '68b843a938380d2d18096e69', name: '2nd Std', section: 'A', tenant: '68adb289f748039c5a58ab32', academicYear: '2025-2026' },
  { _id: '68b843ae38380d2d18096e6c', name: '3rd Std', section: 'A', tenant: '68adb289f748039c5a58ab32', academicYear: '2025-2026' },
  { _id: '68b843b438380d2d18096e6f', name: '4th Std', section: 'A', tenant: '68adb289f748039c5a58ab32', academicYear: '2025-2026' },
  { _id: '68b843bb38380d2d18096e72', name: '5th Std', section: 'A', tenant: '68adb289f748039c5a58ab32', academicYear: '2025-2026' },
  { _id: '68b843bf38380d2d18096e75', name: '6th Std', section: 'A', tenant: '68adb289f748039c5a58ab32', academicYear: '2025-2026' },
  { _id: '68b843c338380d2d18096e78', name: '7th Std', section: 'A', tenant: '68adb289f748039c5a58ab32', academicYear: '2025-2026' },
  { _id: '68b843c638380d2d18096e7b', name: '8th Std', section: 'A', tenant: '68adb289f748039c5a58ab32', academicYear: '2025-2026' },
  { _id: '68b843ca38380d2d18096e7e', name: '9th Std', section: 'A', tenant: '68adb289f748039c5a58ab32', academicYear: '2025-2026' },
  { _id: '68b843cf38380d2d18096e81', name: '10th Std', section: 'A', tenant: '68adb289f748039c5a58ab32', academicYear: '2025-2026' }
];

function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function uniqSuffix(len = 2) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => chars[randInt(0, chars.length - 1)]).join('');
}
function gradeFromName(name) {
  const m = name.match(/^(\d+)(st|nd|rd|th)\s+Std$/i);
  return m ? parseInt(m[1], 10) : null;
}
function approxDobForGrade(grade) {
  // 1st ~ 6-7 yrs; 10th ~ 15-16 yrs (in 2025)
  const age = 5 + grade + randInt(0, 1); // small variation
  const year = 2025 - age;
  const month = randInt(1, 12);
  const day = randInt(1, 28);
  return new Date(year, month - 1, day);
}
function makePhone(used) {
  let n;
  do { n = `${randItem(['7', '8', '9'])}${randInt(100000000, 999999999)}`; } while (used.has(n));
  used.add(n);
  return n;
}

const FIRST_NAMES = [
  'Aarav','Diya','Vihaan','Anaya','Ishaan','Myra','Advait','Kiara','Arjun','Sara',
  'Reyansh','Tara','Vivaan','Aisha','Kabir','Riya','Atharv','Meera','Dhruv','Saanvi',
  'Aditya','Navya','Kunal','Ira','Raghav','Nisha','Samar','Tanya','Yash','Zoya',
  'Harsh','Prisha','Nivaan','Anvi','Kiaan','Aarohi','Parth','Misha','Arnav','Iraaya'
];
const LAST_NAMES = [
  'Sharma','Verma','Iyer','Nair','Gupta','Mehta','Reddy','Singh','Khan','Das',
  'Pillai','Joshi','Mukherjee','Chatterjee','Bedi','Bhat','Kulkarni','Chawla',
  'Khatri','Patel','Jain','Bansal','Saxena','Ghosh','Bose','Rathore','Malhotra',
  'Saha','Roy','Varma','Agarwal','Desai','Shetty','Menon','Kapoor','Trivedi'
];
const GENDERS = ['Male','Female','Other'];

(async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/CampusFlowDB';
  await mongoose.connect(MONGODB_URI, { autoIndex: true });
  console.log('✅ Connected:', MONGODB_URI);

  const phones = new Set();
  let totalCreated = 0;

  for (const cls of CLASS_DOCS) {
    const tenantId = cls.tenant;
    const classId = cls._id;
    const section = cls.section || 'A';
    const grade = gradeFromName(cls.name) || 1;

    console.log(`\n➡️  Seeding ${cls.name} (${classId}) …`);

    const createdIds = [];
    for (let roll = 1; roll <= 10; roll++) {
      const fn = randItem(FIRST_NAMES);
      const ln = randItem(LAST_NAMES);
      const rollStr = String(roll).padStart(2, '0');

      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}g${grade}r${rollStr}${uniqSuffix()}@${DOMAIN}`;
      const phone = makePhone(phones);

      const doc = {
        tenant: tenantId,
        fname: fn,
        lname: ln,
        email,
        role: 'STUDENT',
        password: DEFAULT_PASSWORD,          // hashed by pre('save')

        // Useful student fields
        class: classId,
        section,
        rollNo: rollStr,
        dob: approxDobForGrade(grade),
        gender: randItem(GENDERS),
        phone
      };

      try {
        const user = await User.create(doc); // ensures pre('save') runs
        createdIds.push(user._id);
        totalCreated++;
        process.stdout.write(`·${rollStr}`);
      } catch (err) {
        // Likely duplicate email (rare) or unique index constraint
        console.error(`\n  ⚠️  Skip roll ${rollStr}: ${err.message}`);
      }
    }

    // Optionally push into Classroom.students[]
    if (Classroom && createdIds.length) {
      try {
        await Classroom.updateOne(
          { _id: classId },
          { $addToSet: { students: { $each: createdIds } } }
        );
        console.log(`\n✅ Linked ${createdIds.length} students to classroom ${cls.name}`);
      } catch (err) {
        console.warn(`\n⚠️ Could not update classroom ${cls.name}: ${err.message}`);
      }
    } else {
      console.log('\nℹ️ Skipped classroom update.');
    }
  }

  console.log(`\n🎉 Done. Created ${totalCreated} students total.`);
  await mongoose.disconnect();
  console.log('🔌 Disconnected');
  process.exit(0);
})();
