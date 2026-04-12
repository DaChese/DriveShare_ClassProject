/*
 * Author: Aldo Medina and Rania Dayekh
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Main server setup and route configuration for DriveShare car rental platform
 */

// =============================================
// IMPORTS AND SETUP
// =============================================

import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import { openDb } from "./src/db.js";
import authRoutes from "./src/routes/auth.js";
import carRoutes from "./src/routes/cars.js";
import bookingRoutes from "./src/routes/bookings.js";
import notificationRoutes from "./src/routes/notifications.js";
import messageRoutes from "./src/routes/messages.js";
import userRoutes from "./src/routes/users.js";
import photoRoutes from "./src/routes/photos.js";
import devSeedRoutes from "./src/routes/devSeed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================
// EXPRESS APP CONFIG
// =============================================

const app = express();

// Middleware configuration
app.use(express.json()); // Parse JSON request bodies
app.use(cookieParser()); // Parse cookies for session management
app.use(express.static(path.join(__dirname, "public"))); // Serve static frontend files

// =============================================
// DATABASE AND ROUTES
// =============================================

const db = await openDb();

// Health check endpoint for monitoring
app.get("/api/health", (req, res) => res.json({ ok: true }));

// API route registration - each route implements specific business logic
app.use("/api/auth", authRoutes(db));        // User authentication and registration
app.use("/api/users", userRoutes(db));       // User profile management
app.use("/api/cars", carRoutes(db));         // Car listing CRUD operations
app.use("/api/bookings", bookingRoutes(db)); // Booking management with payment processing
app.use("/api/notifications", notificationRoutes(db)); // In-app notification system
app.use("/api/messages", messageRoutes(db)); // Inter-user messaging
app.use("/api/photos", photoRoutes());       // Photo upload handling
app.use("/api/dev", devSeedRoutes(db));      // Development data seeding

// =============================================
// ERROR HANDLING
// =============================================

/**
 * Global unhandled promise rejection handler
 * Prevents application crashes from unhandled async errors
 */
process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});

/**
 * Global error handling middleware
 * Catches any unhandled errors and returns standardized error response
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "Server error." });
});

// =============================================
// SERVER STARTUP
// =============================================

const PORT = 3000;
app.listen(PORT, () => console.log(`DriveShare running at http://localhost:${PORT}`));
