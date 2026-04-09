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

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const db = await openDb();

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes(db));
app.use("/api/users", userRoutes(db));
app.use("/api/cars", carRoutes(db));
app.use("/api/bookings", bookingRoutes(db));
app.use("/api/notifications", notificationRoutes(db));
app.use("/api/messages", messageRoutes(db));
app.use("/api/photos", photoRoutes());
app.use("/api/dev", devSeedRoutes(db));

const PORT = 3000;
app.listen(PORT, () => console.log(`DriveShare running at http://localhost:${PORT}`));
