import * as cheerio from 'cheerio';
import type { VitaEMinisteroMeeting, MinisteroPart, VitaCristianaPart } from '../types.js';
import { inferPartTypeIds } from '../utils/ministeroPartTypes.js';

const WOL_BASE = 'https://wol.jw.org';
const WOL_INDEX = `${WOL_BASE}/it/wol/library/r6/lp-i/tutte-le-pubblicazioni/guida-per-ladunanza`;

const IT_MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'
];

const ISSUE_SLUGS = [
  { slug: 'gennaio', months: [1, 2], label: 'Gennaio - Febbraio' },
  { slug: 'marzo', months: [3, 4], label: 'Marzo - Aprile' },
  { slug: 'maggio', months: [5, 6], label: 'Maggio - Giugno' },
  { slug: 'luglio', months: [7, 8], label: 'Luglio - Agosto' },
  { slug: 'settembre', months: [9, 10], label: 'Settembre - Ottobre' },
  { slug: 'novembre', months: [11, 12], label: 'Novembre - Dicembre' },
];

// In-memory cache for parsed meetings: key = "year-month" or "docId"
const meetingCache = new Map<string, VitaEMinisteroMeeting>();
const monthCache = new Map<string, VitaEMinisteroMeeting[]>();

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) {
    throw new Error(`Errore caricamento da wol.jw.org (${res.status}): ${url}`);
  }
  return await res.text();
}

/**
 * Parses date header like "5-11 OTTOBRE" or "28 settembre – 4 ottobre" or "26 ottobre – 1º novembre"
 */
function parseWeekHeader(rawTxt: string, year: number): { day: number; month: number; dateLabel: string; iso: string } | null {
  const clean = rawTxt.toLowerCase().replace(/[º°]/g, '').replace(/\s+/g, ' ').trim();
  
  // Format 1: "28 settembre – 4 ottobre"
  const m1 = clean.match(/^(\d+)\s+([a-z]+)/);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const mName = m1[2];
    const mIdx = IT_MONTHS.indexOf(mName);
    if (mIdx !== -1) {
      return {
        day,
        month: mIdx + 1,
        dateLabel: `${day} ${IT_MONTHS[mIdx]} ${year}`,
        iso: `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      };
    }
  }

  // Format 2: "5-11 ottobre"
  const m2 = clean.match(/^(\d+)\s*-\s*(\d+)\s+([a-z]+)/);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const mName = m2[3];
    const mIdx = IT_MONTHS.indexOf(mName);
    if (mIdx !== -1) {
      return {
        day,
        month: mIdx + 1,
        dateLabel: `${day} ${IT_MONTHS[mIdx]} ${year}`,
        iso: `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      };
    }
  }

  return null;
}

/**
 * Parses an individual meeting article from wol.jw.org
 */
export async function parseMeetingArticle(docIdOrUrl: string, year: number): Promise<VitaEMinisteroMeeting | null> {
  let url = docIdOrUrl;
  if (docIdOrUrl.startsWith('http')) {
    url = docIdOrUrl;
  } else if (docIdOrUrl.startsWith('/')) {
    url = `${WOL_BASE}${docIdOrUrl}`;
  } else {
    url = `${WOL_BASE}/it/wol/d/r6/lp-i/${docIdOrUrl}`;
  }

  const cacheKey = `${year}_${url}`;
  if (meetingCache.has(cacheKey)) {
    return meetingCache.get(cacheKey)!;
  }

  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const rawHeaderDate = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const dateInfo = parseWeekHeader(rawHeaderDate, year);
  if (!dateInfo) {
    return null;
  }

  const reading = $('header h2').first().text().replace(/\s+/g, ' ').trim();

  // Initial song
  const initialH3 = $('h3').first().text().replace(/\s+/g, ' ').trim();
  const initialSongMatch = initialH3.match(/Cantico\s*(\d+)/i);
  const canticoIniziale = initialSongMatch ? `Cantico ${initialSongMatch[1]}` : '';

  // TESORI
  let tesori1Title = '';
  let tesori1Minutes = 10;
  let tesoriGemmeTitle = 'Gemme spirituali';
  let tesoriGemmeMinutes = 10;
  let tesoriLetturaTitle = 'Lettura biblica';
  let tesoriLetturaMinutes = 4;

  $('h3').each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    const nextTxt = $(el).next('div').text() || $(el).next().text() || '';
    if (txt.startsWith('1.')) {
      tesori1Title = txt.replace(/^1\.\s*/, '');
      const m = nextTxt.match(/\((\d+)\s*min\)/);
      if (m) tesori1Minutes = parseInt(m[1], 10);
    } else if (txt.startsWith('2.')) {
      tesoriGemmeTitle = txt.replace(/^2\.\s*/, '');
      const m = nextTxt.match(/\((\d+)\s*min\)/);
      if (m) tesoriGemmeMinutes = parseInt(m[1], 10);
    } else if (txt.startsWith('3.')) {
      tesoriLetturaTitle = txt.replace(/^3\.\s*/, '');
      const m = nextTxt.match(/\((\d+)\s*min\)/);
      if (m) tesoriLetturaMinutes = parseInt(m[1], 10);
      // Try to extract verses, e.g. "Ger 40:1-10"
      const verseMatch = nextTxt.match(/\((\d+\s*min\)\s*)([^(]+)/i);
      if (verseMatch && verseMatch[2].trim()) {
        const verses = verseMatch[2].trim();
        tesoriLetturaTitle = `Lettura biblica (${verses})`;
      }
    }
  });

  // EFFICACI NEL MINISTERO & VITA CRISTIANA
  const ministeroParts: MinisteroPart[] = [];
  const vitaCristianaParts: VitaCristianaPart[] = [];
  let canticoIntermedio = '';
  let studioBiblicoTitle = 'Studio biblico di congregazione';
  let studioBiblicoMinutes = 30;
  let canticoFinale = '';

  let currentSection = ''; // 'tesori' | 'ministero' | 'vita'

  $('h2, h3').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.includes('TESORI DELLA PAROLA')) {
      currentSection = 'tesori';
      return;
    }
    if (text.includes('EFFICACI NEL MINISTERO')) {
      currentSection = 'ministero';
      return;
    }
    if (text.includes('VITA CRISTIANA')) {
      currentSection = 'vita';
      return;
    }

    if (currentSection === 'ministero') {
      const matchNum = text.match(/^(\d+)\.\s*(.+)/);
      if (matchNum) {
        const num = parseInt(matchNum[1], 10);
        const title = matchNum[2];
        const nextDivText = $(el).next('div').text();
        const minMatch = nextDivText.match(/\((\d+)\s*min\)/);
        const minutes = minMatch ? parseInt(minMatch[1], 10) : 3;
        const isTalkOnly =
          nextDivText.toLowerCase().includes('discorso') &&
          !nextDivText.toLowerCase().includes('dimostrazione');

        ministeroParts.push({
          id: 'mp_wol_' + Math.random().toString(36).substring(2, 8),
          number: num,
          title,
          minutes,
          studentId: '',
          assistantId: '',
          hasAssistant: !isTalkOnly,
          partTypeIds: inferPartTypeIds(minutes, !isTalkOnly),
        });
      }
    }

    if (currentSection === 'vita') {
      const songMatch = text.match(/^Cantico\s*(\d+)/i);
      if (songMatch && !canticoIntermedio) {
        canticoIntermedio = `Cantico ${songMatch[1]}`;
        return;
      }
      if (text.includes('Studio biblico di congregazione')) {
        studioBiblicoTitle = 'Studio biblico di congregazione';
        const m = $(el).next('div').text().match(/\((\d+)\s*min\)/);
        if (m) studioBiblicoMinutes = parseInt(m[1], 10);
        return;
      }
      if (text.includes('Commenti conclusivi')) {
        const finalSongMatch = text.match(/Cantico\s*(\d+)/i);
        if (finalSongMatch) {
          canticoFinale = `Cantico ${finalSongMatch[1]}`;
        }
        return;
      }
      const matchNum = text.match(/^(\d+)\.\s*(.+)/);
      if (matchNum) {
        const num = parseInt(matchNum[1], 10);
        const title = matchNum[2];
        const m = $(el).next('div').text().match(/\((\d+)\s*min\)/);
        const minutes = m ? parseInt(m[1], 10) : 15;
        vitaCristianaParts.push({
          id: 'vcp_wol_' + Math.random().toString(36).substring(2, 8),
          number: num,
          title,
          minutes,
          speakerId: '',
        });
      }
    }
  });

  const meeting: VitaEMinisteroMeeting = {
    id: `vm_wol_${dateInfo.iso}`,
    dateStr: dateInfo.iso,
    dateLabel: dateInfo.dateLabel,
    bibleReading: reading || 'LETTURA BIBLICA',
    canticoIniziale,
    tesori1Title,
    tesori1Minutes,
    tesoriGemmeTitle,
    tesoriGemmeMinutes,
    tesoriLetturaTitle,
    tesoriLetturaMinutes,
    ministeroParts,
    canticoIntermedio,
    vitaCristianaParts,
    studioBiblicoTitle,
    studioBiblicoMinutes,
    canticoFinale,
  };

  meetingCache.set(cacheKey, meeting);
  return meeting;
}

/**
 * Returns available years of mwb from wol.jw.org
 */
export async function getAvailableYears(): Promise<{ year: number; title: string }[]> {
  try {
    const html = await fetchHtml(WOL_INDEX);
    const $ = cheerio.load(html);
    const years: { year: number; title: string }[] = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('guida-per-ladunanza-vita-e-ministero-')) {
        const title = $(el).text().replace(/\s+/g, ' ').trim();
        const yMatch = href.match(/\d{4}$/);
        if (yMatch) {
          const year = parseInt(yMatch[0], 10);
          years.push({ year, title });
        }
      }
    });

    years.sort((a, b) => b.year - a.year);
    return years;
  } catch (err) {
    console.error('getAvailableYears error:', err);
    // Fallback list of years
    return [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => ({
      year: y,
      title: `Guida per l’adunanza Vita e ministero ${y}`,
    }));
  }
}

/**
 * Fetch all meetings for a given month and year
 * @param month 1-12 (1 = Gennaio, 10 = Ottobre)
 */
export async function fetchMonthMeetings(year: number, month: number): Promise<VitaEMinisteroMeeting[]> {
  const monthCacheKey = `${year}_${month}`;
  if (monthCache.has(monthCacheKey)) {
    return monthCache.get(monthCacheKey)!;
  }

  // Determine which issue covers this month
  const issue = ISSUE_SLUGS.find(i => i.months.includes(month)) || ISSUE_SLUGS[4];
  const issueUrl = `${WOL_INDEX}/guida-per-ladunanza-vita-e-ministero-${year}/${issue.slug}`;

  const html = await fetchHtml(issueUrl);
  const $ = cheerio.load(html);

  // Find article links
  const articleLinks: string[] = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.match(/\/it\/wol\/d\/r6\/lp-i\/\d+/)) {
      if (!articleLinks.includes(href)) {
        articleLinks.push(href);
      }
    }
  });

  const parsedMeetings: VitaEMinisteroMeeting[] = [];

  for (const link of articleLinks) {
    try {
      const meeting = await parseMeetingArticle(link, year);
      if (meeting && meeting.dateStr) {
        const parts = meeting.dateStr.split('-');
        const m = parseInt(parts[1], 10);
        if (m === month) {
          parsedMeetings.push(meeting);
        }
      }
    } catch (e) {
      console.error(`Failed to parse article ${link}:`, e);
    }
  }

  // Sort by date ascending
  parsedMeetings.sort((a, b) => (a.dateStr || '').localeCompare(b.dateStr || ''));

  monthCache.set(monthCacheKey, parsedMeetings);
  return parsedMeetings;
}

/**
 * Fetch all meetings for all available months in a year
 */
export async function fetchAllYearMeetings(year: number): Promise<VitaEMinisteroMeeting[]> {
  const allMeetings: VitaEMinisteroMeeting[] = [];

  for (const issue of ISSUE_SLUGS) {
    try {
      const issueUrl = `${WOL_INDEX}/guida-per-ladunanza-vita-e-ministero-${year}/${issue.slug}`;
      const html = await fetchHtml(issueUrl);
      const $ = cheerio.load(html);

      const articleLinks: string[] = [];
      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.match(/\/it\/wol\/d\/r6\/lp-i\/\d+/)) {
          if (!articleLinks.includes(href)) {
            articleLinks.push(href);
          }
        }
      });

      for (const link of articleLinks) {
        try {
          const meeting = await parseMeetingArticle(link, year);
          if (meeting && !allMeetings.some(m => m.dateStr === meeting.dateStr)) {
            allMeetings.push(meeting);
          }
        } catch (e) {
          console.error(`Failed to parse ${link}:`, e);
        }
      }
    } catch (err) {
      console.warn(`Issue ${issue.slug} not available for year ${year}:`, err);
    }
  }

  allMeetings.sort((a, b) => (a.dateStr || '').localeCompare(b.dateStr || ''));
  return allMeetings;
}
