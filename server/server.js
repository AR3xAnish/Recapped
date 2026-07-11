const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const apiRoutes = require("./routes");

// Load environment variables from .env
dotenv.config();

// Enforce Notion environment configuration
const requiredEnvVars = [
  "NOTION_CLIENT_ID",
  "NOTION_CLIENT_SECRET",
  "NOTION_REDIRECT_URI",
  "NOTION_ENCRYPTION_KEY",
];
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingEnvVars.length > 0) {
  throw new Error(
    `[Startup Error] Missing required Notion environment configuration variables: ${missingEnvVars.join(
      ", "
    )}`
  );
}

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api", apiRoutes);

// Global Error Handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// Port configuration
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
