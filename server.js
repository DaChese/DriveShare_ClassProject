/**
 * DriveShare - Car Rental Platform Server
 *
 * Main application entry point that configures Express.js server with:
 * - RESTful API routes for authentication, cars, bookings, messaging
 * - SQLite database integration
 * - Static file serving for frontend assets
 * - Error handling and logging
 * - Design pattern implementations throughout the application
 *
 * Architecture follows MVC pattern with route handlers, database models,
 * and service layers implementing various design patterns.
 */

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

/**
 * Express application instance
 * Configured with JSON parsing, cookie handling, and static file serving
 */
const app = express();

// Middleware configuration
app.use(express.json()); // Parse JSON request bodies
app.use(cookieParser()); // Parse cookies for session management
app.use(express.static(path.join(__dirname, "public"))); // Serve static frontend files

/**
 * Database connection
 * SQLite database instance shared across all routes
 */
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

// Server startup
const PORT = 3000;
app.listen(PORT, () => console.log(`DriveShare running at http://localhost:${PORT}`));
