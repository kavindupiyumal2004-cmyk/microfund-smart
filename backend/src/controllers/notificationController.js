const { Notification } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middleware/errorHandler');

exports.list = asyncHandler(async (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 30;

  const [data, unread] = await Promise.all([
    Notification.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit,
    }),
    Notification.count({ where: { user_id: req.user.id, read_at: null } }),
  ]);

  res.json({ success: true, data: Array.isArray(data) ? data : [], unread });
});

exports.readOne = asyncHandler(async (req, res) => {
  const item = await Notification.findOne({
    where: { id: req.params.id, user_id: req.user.id },
  });
  if (!item) throw new AppError('Notification not found.', 404);
  if (!item.read_at) await item.update({ read_at: new Date() });
  res.json({ success: true, data: item });
});

exports.readAll = asyncHandler(async (req, res) => {
  const [updated] = await Notification.update(
    { read_at: new Date() },
    { where: { user_id: req.user.id, read_at: null } },
  );
  res.json({ success: true, message: 'All notifications marked as read.', updated });
});
