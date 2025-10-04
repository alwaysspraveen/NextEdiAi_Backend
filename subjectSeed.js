/**
 * seed_subjects_by_class.js
 * Seeds subjects for each class in CLASS_DOCS.
 *
 * Usage:
 *   MONGODB_URI="mongodb://127.0.0.1:27017/CampusFlowDB" node seed_subjects_by_class.js
 */

const mongoose = require("mongoose");
const path = require("path");
const Subject = require("./src/models/Subject");
const User = require("./src/models/User");

const CLASS_DOCS = [
  {
    _id: "68b8439b38380d2d18096e66",
    name: "1st Std",
    section: "A",
    tenant: "68adb289f748039c5a58ab32",
    academicYear: "2025-2026",
  },
  {
    _id: "68b843a938380d2d18096e69",
    name: "2nd Std",
    section: "A",
    tenant: "68adb289f748039c5a58ab32",
    academicYear: "2025-2026",
  },
  {
    _id: "68b843ae38380d2d18096e6c",
    name: "3rd Std",
    section: "A",
    tenant: "68adb289f748039c5a58ab32",
    academicYear: "2025-2026",
  },
  {
    _id: "68b843b438380d2d18096e6f",
    name: "4th Std",
    section: "A",
    tenant: "68adb289f748039c5a58ab32",
    academicYear: "2025-2026",
  },
  {
    _id: "68b843bb38380d2d18096e72",
    name: "5th Std",
    section: "A",
    tenant: "68adb289f748039c5a58ab32",
    academicYear: "2025-2026",
  },
  {
    _id: "68b843bf38380d2d18096e75",
    name: "6th Std",
    section: "A",
    tenant: "68adb289f748039c5a58ab32",
    academicYear: "2025-2026",
  },
  {
    _id: "68b843c338380d2d18096e78",
    name: "7th Std",
    section: "A",
    tenant: "68adb289f748039c5a58ab32",
    academicYear: "2025-2026",
  },
  {
    _id: "68b843c638380d2d18096e7b",
    name: "8th Std",
    section: "A",
    tenant: "68adb289f748039c5a58ab32",
    academicYear: "2025-2026",
  },
  {
    _id: "68b843ca38380d2d18096e7e",
    name: "9th Std",
    section: "A",
    tenant: "68adb289f748039c5a58ab32",
    academicYear: "2025-2026",
  },
  {
    _id: "68b843cf38380d2d18096e81",
    name: "10th Std",
    section: "A",
    tenant: "68adb289f748039c5a58ab32",
    academicYear: "2025-2026",
  },
];

const SUBJECTS_MAP = {
  primary: ["English", "Maths", "EVS", "Hindi", "GK", "Drawing"],
  middle: [
    "English",
    "Maths",
    "Science",
    "Social Science",
    "Hindi",
    "Computer",
  ],
  high: [
    "English",
    "Maths",
    "Physics",
    "Chemistry",
    "Biology",
    "History",
    "Geography",
    "Computer",
  ],
};

function getSubjectsForGrade(grade) {
  if (grade <= 2) return SUBJECTS_MAP.primary.slice(0, 4);
  if (grade <= 5) return SUBJECTS_MAP.primary;
  if (grade <= 7) return SUBJECTS_MAP.middle;
  return SUBJECTS_MAP.high;
}

function gradeFromName(name) {
  const m = name.match(/^(\d+)(st|nd|rd|th)\s+Std$/i);
  return m ? parseInt(m[1], 10) : null;
}

function codeFor(subject) {
  return subject.toUpperCase().replace(/\s+/g, "_");
}

(async function main() {
  const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/CampusFlowDB";
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected:", MONGODB_URI);

  let total = 0;

  // 🔍 Get all teachers
  const teachers = await User.find({ role: "TEACHER" }).select("_id").lean();
  const teacherIds = teachers.map((t) => t._id);

  for (const cls of CLASS_DOCS) {
    const grade = gradeFromName(cls.name) || 1;
    const subjects = getSubjectsForGrade(grade);
    const created = [];

    for (const subj of subjects) {
      const code = codeFor(subj);
      const teacher =
        teacherIds.length > 0
          ? teacherIds[Math.floor(Math.random() * teacherIds.length)]
          : null;

      const doc = {
        name: subj,
        code,
        classroom: cls._id,
        tenant: cls.tenant,
        academicYear: cls.academicYear,
        teacher,
      };

      try {
        await Subject.create(doc);
        created.push(code);
        total++;
      } catch (err) {
        console.warn(`⚠️ Skipped ${code} (${cls.name}): ${err.message}`);
      }
    }

    console.log(
      `📘 ${cls.name}: Created ${created.length} subjects → [${created.join(
        ", "
      )}]`
    );
  }

  console.log(`\n🎉 Done. Total subjects created: ${total}`);
  await mongoose.disconnect();
  process.exit(0);
})();
