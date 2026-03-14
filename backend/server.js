import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import medicationRoutes from './routes/medications.js';
import profileRoutes from './routes/profile.js';
import posRoutes from './routes/pos.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const posLogosPath = path.resolve(__dirname, '..', 'frontend', 'src', 'assets', 'pos');
app.use('/pos-logos', express.static(posLogosPath));

// --- Cached MongoDB Connection ---
let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Prevents buffering/timeouts in Serverless environments
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
    };
    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => mongoose);
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}

// Middleware to ensure DB is connected before any route
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/pos', posRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

export default app;