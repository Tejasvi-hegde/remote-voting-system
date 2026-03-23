const jwt = require('jsonwebtoken');

/**
 * Middleware: protect routes that require a valid session.
 * The terminal sends the JWT token it received from /api/auth/verify
 * in the Authorization header: "Bearer <token>"
 */
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Access denied.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.voter = decoded;   // { voterID, constituencyID, terminalID, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please re-authenticate.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = { protect };
