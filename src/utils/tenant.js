exports.T = (req, query = {}) => {
  if (!req.user || !req.user.tenant) {
    throw Object.assign(new Error("Unauthorized: Tenant missing"), {
      status: 401,
    });
  }
  return { ...query, tenant: req.user.tenant };
};
