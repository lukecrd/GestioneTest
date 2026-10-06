import { Router } from 'express';
import { accessRouter } from './accessRouter.js';
import {
  getAvailableYears,
  fetchMonthMeetings,
  fetchAllYearMeetings,
} from './wolScraper.js';

export const apiRouter = Router();
apiRouter.use('/access', accessRouter);

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Get available years from wol.jw.org
apiRouter.get('/wol/years', async (req, res) => {
  try {
    const years = await getAvailableYears();
    res.json({ success: true, years });
  } catch (err: any) {
    console.error('API /api/wol/years error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get meetings for a specific month (1-12) and year from wol.jw.org
apiRouter.get('/wol/month', async (req, res) => {
  try {
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month as string, 10) || (new Date().getMonth() + 1);

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, error: 'Mese non valido (deve essere tra 1 e 12)' });
    }

    const meetings = await fetchMonthMeetings(year, month);
    res.json({ success: true, year, month, count: meetings.length, meetings });
  } catch (err: any) {
    console.error('API /api/wol/month error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all available meetings for an entire year from wol.jw.org
apiRouter.get('/wol/year', async (req, res) => {
  try {
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    const meetings = await fetchAllYearMeetings(year);
    res.json({ success: true, year, count: meetings.length, meetings });
  } catch (err: any) {
    console.error('API /api/wol/year error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
