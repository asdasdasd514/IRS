import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to IRS RESTful API',
    documentation: '/api/health'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`⚡️ [Server]: IRS Backend server is running at http://localhost:${PORT}`);
});

export default app;
