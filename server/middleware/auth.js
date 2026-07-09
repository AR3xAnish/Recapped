const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  // Get token from header
  const authHeader = req.header("Authorization");
  
  if (!authHeader) {
    return res.status(401).json({ error: "Access denied. No authorization header provided." });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Access denied. Invalid token format. Expected: Bearer <token>" });
  }

  const token = parts[1];

  try {
    const secret = process.env.JWT_SECRET || "fallback_development_secret_do_not_use_in_production";
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Access denied. Invalid or expired token." });
  }
};

module.exports = auth;
