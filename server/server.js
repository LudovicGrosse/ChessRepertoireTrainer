require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const historyRoutes = require("./routes/historyRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "../public")));

// API Routes
app.use("/api", authRoutes);
app.use("/api/history", historyRoutes);

// Fallback to index.html for SPA (Single Page Application) behavior
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 La Boîte à Ouvertures Server started at port ${PORT}`);
});
