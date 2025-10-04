const mongoose = require('mongoose');
const { Schema } = mongoose;

/** One row of the weekly template */
const TimeTableEntrySchema = new Schema(
  {
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', index: true },
    day: { type: String, enum: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], index: true },
    periodKey: { type: String, index: true }, // 'P1'|'P2'|'BREAK'...
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher' },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
  },
  { timestamps: true }
);

TimeTableEntrySchema.index({ day: 1, periodKey: 1, teacherId: 1 });
TimeTableEntrySchema.index({ day: 1, periodKey: 1, classroomId: 1 });

module.exports = mongoose.model('TimeTableEntry', TimeTableEntrySchema);
