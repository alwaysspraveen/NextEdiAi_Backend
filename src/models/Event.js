import mongoose from "mongoose";
const { Schema, model } = mongoose;

const EventSchema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: String,
    location: String,
    color: String,

    allDay: { type: Boolean, default: false },
    start: { type: Date }, // for non-recurring
    end: { type: Date },

    // Recurrence (client expands via @fullcalendar/rrule)
    rrule: { type: Schema.Types.Mixed }, // object or string
    exdate: [{ type: Date }],
    duration: { type: String }, // e.g. "00:30" for recurring events

    attendees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },

    joinUrl: String,
  },
  { timestamps: true }
);

// Helpful indexes
EventSchema.index({ tenantId: 1, start: 1, end: 1 });
EventSchema.index({ tenantId: 1, rrule: 1 });

// Normalize JSON
EventSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

export const EventModel = model("Event", EventSchema);
