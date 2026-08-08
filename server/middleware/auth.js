const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  // Get token from header
  let token;
  const authHeader = req.header("Authorization");

  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res
        .status(401)
        .json({ error: "Access denied. Invalid token format. Expected: Bearer <token>" });
    }
    token = parts[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Access denied. No authorization token provided." });
  }

  try {
    const secret = process.env.JWT_SECRET || "fallback_development_secret_do_not_use_in_production";
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Access denied. Invalid or expired token." });
  }
};

module.exports = auth;
