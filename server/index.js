require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { initDB } = require('./config/db');
const { initMediasoup } = require('./services/mediasoup.service');
const { initSocket } = require('./socket');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const sessionRoutes = require('./routes/session.routes');
const adminRoutes = require('./routes/admin.routes');
const intelligenceRoutes = require('./routes/intelligence.routes');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/intelligence', intelligenceRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use(errorHandler);

async function start() {
  try {
    initDB();
    logger.info('Database initialized');

    await initMediasoup();
    logger.info('Mediasoup workers started');

    initSocket(server);
    logger.info('Socket.io initialized');

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      logger.info(`SupportVision server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start();
