// api/user.js - МАКСИМАЛЬНО ПРОСТОЙ
module.exports = (req, res) => {
  console.log('✅ API работает! Получен запрос');
  
  return res.status(200).json({
    success: true,
    message: 'API работает!',
    timestamp: new Date().toISOString(),
    query: req.query,
    tgId: req.query.tgId
  });
};
