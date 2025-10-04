// Seed a tenant (and principal), optionally sample data
// Usage examples:
//  node src/utils/seedTenant.js --code greenvalley --name "Green Valley School" --email principal@greenvalley.local --password admin123 --with-sample
//  npm run seed:tenant -- --code blueoak --name "Blue Oak High"

require('dotenv').config();
const { connectDB } = require('./src/config/db');
const Tenant = require('./src/models/Tenant');
const User = require('./src/models/User');
const Classroom = require('./src/models/Classroom');
const Subject = require('./src/models/Subject');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const val = (args[i + 1] || '').startsWith('--') ? true : args[i + 1];
      out[key] = val === undefined ? true : val;
      if (val !== true && !(val || '').startsWith('--')) i++;
    }
  }
  return out;
};

const args = parseArgs();
const code = (args.code || 'greenvalley').toLowerCase();
const name = args.name || 'Green Valley School';
const email = args.email || `principal@${code}.local`;
const password = args.password || 'admin123';
const withSample = !!args['with-sample'];

(async () => {
  try {
    await connectDB();

    // 1) Upsert Tenant
    const tenant = await Tenant.findOneAndUpdate(
      { code },
      { name, code },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2) Upsert Principal user (email unique per tenant)
    let principal = await User.findOne({ tenant: tenant._id, email });
    if (!principal) {
      principal = await User.create({
        tenant: tenant._id,
        name: 'Principal Admin',
        email,
        password,
        role: 'PRINCIPAL'
      });
      console.log(`✅ Principal created: ${email} (pass: ${password})`);
    } else {
      console.log(`ℹ️  Principal already exists: ${email}`);
    }

    // 3) Optional sample data
    if (withSample) {
      // Teacher
      let teacher = await User.findOne({ tenant: tenant._id, email: `alice.${code}@school.com` });
      if (!teacher) {
        teacher = await User.create({
          tenant: tenant._id,
          name: 'Alice Teacher',
          email: `alice.${code}@school.com`,
          password: 'pass123',
          role: 'TEACHER'
        });
        console.log(`✅ Teacher created: ${teacher.email} / pass123`);
      }

      // Student
      let student = await User.findOne({ tenant: tenant._id, email: `john.${code}@student.com` });
      if (!student) {
        student = await User.create({
          tenant: tenant._id,
          name: 'John Student',
          email: `john.${code}@student.com`,
          password: 'pass123',
          role: 'STUDENT'
        });
        console.log(`✅ Student created: ${student.email} / pass123`);
      }

      // Class
      let classroom = await Classroom.findOne({
        tenant: tenant._id,
        name: 'Grade 8',
        section: 'A',
        academicYear: '2025-2026'
      });

      if (!classroom) {
        classroom = await Classroom.create({
          tenant: tenant._id,
          name: 'Grade 8',
          section: 'A',
          academicYear: '2025-2026',
          classTeacher: teacher._id,
          students: [student._id]
        });
        console.log(`✅ Classroom created: ${classroom.name}-${classroom.section}`);
      } else {
        // ensure teacher & student are in place
        if (!classroom.students.find(id => id.toString() === student._id.toString())) {
          classroom.students.push(student._id);
        }
        if (!classroom.classTeacher) classroom.classTeacher = teacher._id;
        await classroom.save();
        console.log(`ℹ️  Classroom exists: ${classroom.name}-${classroom.section}`);
      }

      // Subject
      let subject = await Subject.findOne({
        tenant: tenant._id,
        classroom: classroom._id,
        code: 'MATH-8'
      });
      if (!subject) {
        subject = await Subject.create({
          tenant: tenant._id,
          classroom: classroom._id,
          name: 'Mathematics',
          code: 'MATH-8',
          teacher: teacher._id
        });
        console.log(`✅ Subject created: ${subject.name} (${subject.code})`);
      } else {
        console.log(`ℹ️  Subject exists: ${subject.name} (${subject.code})`);
      }

      console.log('📦 Sample data IDs:');
      console.log('   tenantId   :', tenant._id.toString());
      console.log('   principalId:', principal._id.toString());
      console.log('   teacherId  :', teacher._id.toString());
      console.log('   studentId  :', student._id.toString());
      console.log('   classId    :', classroom._id.toString());
      console.log('   subjectId  :', subject._id.toString());
    }

    console.log('\n✅ Tenant ready:');
    console.log('   code     :', tenant.code);
    console.log('   tenantId :', tenant._id.toString());
    console.log('   login    :', email, '/', password);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    if (process.env.NODE_ENV !== 'production') console.error(err);
    process.exit(1);
  }
})();
