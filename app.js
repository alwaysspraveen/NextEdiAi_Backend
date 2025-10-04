const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { connectDB } = require("./src/config/db");
const { notFound, errorHandler } = require("./src/middlewares/error");

const authRoutes = require("./src/routes/auth.route");
const userRoutes = require("./src/routes/user.route");
const classRoutes = require("./src/routes/class.route");
const attendanceRoutes = require("./src/routes/attendance.route");
const examRoutes = require("./src/routes/exam.route");
const assignmentRoutes = require("./src/routes/assignment.route");
const materialRoutes = require("./src/routes/material.route");
const feeRoutes = require("./src/routes/fee.route");
const noticeRoutes = require("./src/routes/notice.route");
const eventRoutes = require("./src/routes/event.route");
const subjectRoutes = require("./src/routes/subject.route");
const timetableRoutes = require("./src/routes/timetable.route");
const leaveRoutes = require("./src/routes/leaves.route");
const substitutionRoutes = require("./src/routes/substitutions.route");
const notifyRoute = require("./src/routes/notify.route");

connectDB();
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/", (_, res) => res.json({ ok: true, name: "CampusFlow MT" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/subjects", subjectRoutes); // for backward compatibility
app.use("/api/attendance", attendanceRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/substitutions", substitutionRoutes);
app.use("/api/push-notify", notifyRoute);

app.use(notFound);
app.use(errorHandler);
module.exports = app;
