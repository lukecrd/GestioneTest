import express from 'express';
import { apiRouter } from '../src/server/apiRouter.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

// Support both /api/* and direct routing on Vercel
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
