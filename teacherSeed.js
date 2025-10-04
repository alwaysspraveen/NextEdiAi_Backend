/**
 * seed_teachers.js
 * Seeds 15 random teachers under the same tenant.
 *
 * Usage:
 *   MONGODB_URI="mongodb://127.0.0.1:27017/CampusFlowDB" node seed_teachers.js
 */

const mongoose = require("mongoose");
const User = require("./src/models/User");

const DOMAIN = "schoolmail.in";
const DEFAULT_PASSWORD = "Temp@12345";
const TEACHER_COUNT = 15;
const TENANT_ID = "68adb289f748039c5a58ab32"; // Replace with your actual tenant ID

const FIRST_NAMES = [
  "Aarav", "Anaya", "Kabir", "Ishita", "Vivaan", "Diya", "Aditya", "Meera",
  "Raghav", "Tanya", "Yash", "Zoya", "Harsh", "Nivaan", "Parth", "Misha",
  "Arnav", "Kiara", "Atharv", "Saanvi", "Neha", "Rahul", "Sneha", "Vikas",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Iyer", "Nair", "Gupta", "Mehta", "Reddy", "Singh",
  "Khan", "Das", "Pillai", "Joshi", "Bose", "Rathore", "Saha", "Roy",
  "Shetty", "Kapoor", "Trivedi", "Mishra", "Chopra", "Ahuja"
];
const GENDERS = ["Male", "Female", "Other"];

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makePhone(used) {
  let n;
  do {
    n = `${randItem(["7", "8", "9"])}${randInt(100000000, 999999999)}`;
  } while (used.has(n));
  used.add(n);
  return n;
}

function makeEmail(first, last, index) {
  return `${first.toLowerCase()}.${last.toLowerCase()}t${index}${randInt(10,99)}@${DOMAIN}`;
}

(async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/CampusFlowDB";
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected:", MONGODB_URI);

  const phones = new Set();
  let created = 0;

  for (let i = 1; i <= TEACHER_COUNT; i++) {
    const fn = randItem(FIRST_NAMES);
    const ln = randItem(LAST_NAMES);
    const email = makeEmail(fn, ln, i);
    const phone = makePhone(phones);

    const teacher = {
      tenant: TENANT_ID,
      fname: fn,
      lname: ln,
      email,
      phone,
      gender: randItem(GENDERS),
      role: "TEACHER",
      password: DEFAULT_PASSWORD, // Will be hashed via pre('save')
    };

    try {
      await User.create(teacher);
      created++;
      console.log(`👨‍🏫 Created: ${fn} ${ln} (${email})`);
    } catch (err) {
      console.warn(`⚠️ Failed to create ${email}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Done. Created ${created} teacher(s).`);
  await mongoose.disconnect();
})();
