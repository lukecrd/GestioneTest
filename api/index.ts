import express from 'express';
import { apiRouter } from '../src/server/apiRouter';

const app = express();
app.use(express.json());

// Support both /api/* and direct routing on Vercel
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
