// utils/fcm.js
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require("./service-account.json")) });

function toStringData(data = {}) {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
}

async function sendToTokens(tokens, { title, body, data = {} }) {
  const payload = { tokens, notification: { title, body }, data: toStringData(data) };
  if (admin.messaging().sendEachForMulticast) {
    return admin.messaging().sendEachForMulticast(payload);
  }
  if (admin.messaging().sendMulticast) {
    return admin.messaging().sendMulticast(payload);
  }
  // fallback
  const msgs = tokens.map(t => ({ token: t, notification: { title, body }, data: toStringData(data) }));
  const r = await admin.messaging().sendAll(msgs);
  return { successCount: r.successCount, failureCount: r.failureCount, responses: r.responses };
}
module.exports = { admin, sendToTokens };
