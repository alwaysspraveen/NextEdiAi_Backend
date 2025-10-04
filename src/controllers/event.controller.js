import mongoose from "mongoose";
import { EventModel } from "../models/Event.js";
const { Types } = mongoose;

const ok = (res, data) => res.json(data);
const bad = (res, msg) => res.status(400).json({ error: msg });
const notFound = (res) => res.status(404).json({ error: "Not found" });
const getTenantId = (req) => req.user && req.user.tenant;
const getUserId = (req) => req.user && req.user.id;

// helper
function parseISO(value) {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value); // handles %3A etc.
    const date = new Date(decoded);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export async function listEvents(req, res) {
  const tenantId = getTenantId(req);

  const from = parseISO(req.query.from);
  const to = parseISO(req.query.to);

  if (!from || !to) {
    return res
      .status(400)
      .json({ error: 'Invalid "from" or "to" date format.' });
  }

  // Ensure query captures all-day and time-specific events
  const query = {
    tenantId,
    $and: [
      {
        $or: [
          // Starts in range
          { start: { $gte: from, $lte: to } },
          // Ends in range
          { end: { $gte: from, $lte: to } },
          // Event spans the entire range
          {
            start: { $lte: from },
            end: { $gte: to },
          },
          // Recurring
          { rrule: { $exists: true } },
        ],
      },
    ],
  };

  try {
    const events = await EventModel.find(query).lean();
    return res.json(events.map((e) => ({ ...e, id: String(e._id) })));
  } catch (error) {
    console.error("[Error fetching events]", error);
    return res.status(500).json({ error: "Failed to fetch events" });
  }
}

export async function createEvent(req, res) {
  const tenantId = getTenantId(req);
  if (!tenantId) return bad(res, "Missing tenantId");

  const {
    title,
    description,
    location,
    color,
    allDay,
    start,
    end,
    rrule,
    exdate,
    duration,
    attendees = [],
    organizer,
    joinUrl,
  } = req.body || {};

  if (!title) return bad(res, "title is required");

  if (!rrule) {
    if (!start || !end)
      return bad(res, "start and end are required for non-recurring events");
    if (new Date(start) >= new Date(end))
      return bad(res, "end must be after start");
  }

  const created = await EventModel.create({
    tenantId,
    title,
    description,
    location,
    color,
    allDay: !!allDay,
    start: start ? new Date(start) : undefined,
    end: end ? new Date(end) : undefined,
    rrule: rrule || undefined,
    exdate: Array.isArray(exdate) ? exdate.map((d) => new Date(d)) : undefined,
    duration,
    attendees: attendees.map((id) => new Types.ObjectId(id)),
    organizer: req.user._id, // ✅ use _id, safer
    joinUrl,
  });

  const io = req.app.get("io");
  if (io) io.to(`calendar-${tenantId}`).emit("event:created", created.toJSON());

  return ok(res, created.toJSON());
}

export async function updateEvent(req, res) {
  const tenantId = getTenantId(req);
  if (!tenantId) return bad(res, "Missing tenantId");

  const id = req.params.id;
  if (!Types.ObjectId.isValid(id)) return bad(res, "Invalid id");

  const patch = {};
  const allowed = [
    "title",
    "description",
    "location",
    "color",
    "allDay",
    "start",
    "end",
    "rrule",
    "exdate",
    "duration",
    "joinUrl",
    "attendees",
    "organizer",
  ];
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

  if ("start" in patch)
    patch.start = patch.start ? new Date(patch.start) : undefined;
  if ("end" in patch) patch.end = patch.end ? new Date(patch.end) : undefined;
  if ("exdate" in patch && Array.isArray(patch.exdate)) {
    patch.exdate = patch.exdate.map((d) => new Date(d));
  }
  if ("attendees" in patch && Array.isArray(patch.attendees)) {
    patch.attendees = patch.attendees.map((id) => new Types.ObjectId(id));
  }
  if ("organizer" in patch && patch.organizer) {
    patch.organizer = new Types.ObjectId(patch.organizer);
  }

  const updated = await EventModel.findOneAndUpdate(
    { _id: id, tenantId },
    { $set: patch },
    { new: true }
  );
  if (!updated) return notFound(res);

  const io = req.app.get("io");
  if (io) io.to(`calendar-${tenantId}`).emit("event:updated", updated.toJSON());

  return ok(res, updated.toJSON());
}

export async function deleteEvent(req, res) {
  const tenantId = getTenantId(req);
  if (!tenantId) return bad(res, "Missing tenantId");

  const id = req.params.id;
  if (!Types.ObjectId.isValid(id)) return bad(res, "Invalid id");

  const deleted = await EventModel.findOneAndDelete({ _id: id, tenantId });
  if (!deleted) return notFound(res);

  const io = req.app.get("io");
  if (io)
    io.to(`calendar-${tenantId}`).emit("event:deleted", String(deleted._id));

  return ok(res, { ok: true });
}

/** Simple availability suggestions (non-recurring busy only) */
export async function availability(req, res) {
  const tenantId = getTenantId(req);
  if (!tenantId) return bad(res, "Missing tenantId");

  const {
    from,
    to,
    attendees = [],
    durationMin = 30,
    businessHours,
  } = req.body || {};
  const start = new Date(from);
  const end = new Date(to);
  if (!from || !to || isNaN(+start) || isNaN(+end) || start >= end) {
    return bad(res, "from/to (ISO) invalid");
  }

  const busyEvents = await EventModel.find({
    tenantId,
    $or: [
      { start: { $lt: end }, end: { $gt: start } },
      { rrule: { $exists: true } },
    ],
    attendees: { $in: attendees.map((id) => new Types.ObjectId(id)) },
  }).lean();

  const busy = busyEvents
    .filter((e) => e.start && e.end)
    .map((e) => ({ start: new Date(e.start), end: new Date(e.end) }))
    .sort((a, b) => +a.start - +b.start);

  const daysOfWeek = (businessHours && businessHours.daysOfWeek) || [
    1, 2, 3, 4, 5,
  ];
  const [bhStartH, bhStartM] = (businessHours?.start || "09:00")
    .split(":")
    .map(Number);
  const [bhEndH, bhEndM] = (businessHours?.end || "18:00")
    .split(":")
    .map(Number);

  const dayWindows = [];
  for (
    let d = new Date(start);
    d <= end;
    d = new Date(d.getTime() + 86400000)
  ) {
    const dow = d.getDay(); // 0..6 (Sun..Sat)
    const iso = dow === 0 ? 7 : dow;
    if (!daysOfWeek.includes(iso)) continue;
    const ws = new Date(d);
    ws.setHours(bhStartH, bhStartM, 0, 0);
    const we = new Date(d);
    we.setHours(bhEndH, bhEndM, 0, 0);
    if (we > start && ws < end) {
      dayWindows.push({
        start: ws < start ? start : ws,
        end: we > end ? end : we,
      });
    }
  }

  const subtractBusy = (win, blocks) => {
    const free = [];
    let cur = new Date(win.start);
    for (const b of blocks) {
      if (b.end <= win.start || b.start >= win.end) continue;
      if (cur < b.start)
        free.push({
          start: new Date(cur),
          end: new Date(Math.min(+b.start, +win.end)),
        });
      if (b.end > cur) cur = new Date(Math.max(+cur, +b.end));
      if (cur >= win.end) break;
    }
    if (cur < win.end)
      free.push({ start: new Date(cur), end: new Date(win.end) });
    return free;
  };

  const suggestions = [];
  for (const w of dayWindows) {
    const free = subtractBusy(w, busy);
    for (const f of free) {
      let s = new Date(f.start);
      while (s.getTime() + durationMin * 60000 <= f.end.getTime()) {
        const e = new Date(s.getTime() + durationMin * 60000);
        suggestions.push({ start: new Date(s), end: e });
        s = new Date(s.getTime() + durationMin * 60000);
      }
    }
  }

  return ok(res, { suggestions });
}
