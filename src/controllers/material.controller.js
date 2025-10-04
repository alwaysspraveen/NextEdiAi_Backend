const asyncHandler = require("../utils/asyncHandler");
const Material = require("../models/Material");
const { T } = require("../utils/tenant");

exports.create = asyncHandler(async (req, res) => {
  const { classId, materialId, subjectId } = req.body;
  if (!materialId || !classId || !subjectId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const doc = await Material.create({
    materialId,
    classId: classId,
    subjectId: subjectId,
  });

  res.status(201).json(doc);
});

exports.list = asyncHandler(async (req, res) => {
  const { classId, subjectId } = req.params;

  if (!classId || !subjectId) {
    return res
      .status(400)
      .json({ message: "classId and subjectId are required" });
  }

  const materials = await Material.find({ classId, subjectId }).lean();

  res.json(materials);
});
