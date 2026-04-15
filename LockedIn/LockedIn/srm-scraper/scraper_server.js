import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import multer from 'multer';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import xssClean from 'xss-clean';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import * as cheerio from 'cheerio';
import { s3Client, isS3Enabled, BUCKET_NAME } from './src/config/aws_config.js';
import { PutObjectCommand } from "@aws-sdk/client-s3";

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse/lib/pdf-parse.js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'lockedin_secret_key_2026';

// ═══════════════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE (Criterion: Security Implementation)
// ═══════════════════════════════════════════════════════════════════════
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(xssClean());

// Rate limiting to prevent brute force
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    req.user = decoded;
    next();
  });
};

// ═══════════════════════════════════════════════════════════════════════
// SRM ACADEMIA — API Login Config (from SRM-Academia-Scraper-API)
// ═══════════════════════════════════════════════════════════════════════
const SRM_CSRF_TOKEN = process.env.SRM_CSRF_TOKEN || '';
const SRM_SESSION_COOKIES = process.env.SRM_SESSION_COOKIES || '';

// ═══════════════════════════════════════════════════════════════════════
// SRM ACADEMIA — Scraping helpers
// ═══════════════════════════════════════════════════════════════════════

function convertHexToHTML(hexString) {
  if (!hexString) return '';
  return hexString.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

function decodeAcademicPayload(payload) {
  if (typeof payload !== 'string') return '';
  const sanitizeMatch = payload.match(/pageSanitizer\.sanitize\('(.*)'\);/s);
  if (!sanitizeMatch?.[1]) return payload;
  return convertHexToHTML(sanitizeMatch[1])
    .replace(/\\\\/g, '')
    .replace(/\\'/g, "'");
}

function normalizeText(value = '') {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value = '') {
  return normalizeText(value).toLowerCase().replace(/[:*]/g, '');
}

function deriveAcademicBranch(program = '', department = '') {
  const text = `${program} ${department}`.toLowerCase();

  if (/\bcse\b/.test(text) || text.includes('computer science') || text.includes('computer engineering')) return 'CSE';
  if (/\bece\b/.test(text) || text.includes('electronics and communication')) return 'ECE';
  if (/\beee\b/.test(text) || text.includes('electrical and electronics')) return 'EEE';
  if (/\bmech\b/.test(text) || text.includes('mechanical')) return 'MECH';
  if (text.includes('civil')) return 'CIVIL';

  return '';
}

function getDirectRows($, table) {
  return $(table).find('> tbody > tr, > tr');
}

function getDirectCells($, row) {
  return $(row).find('> th, > td');
}

function findTableByHeaders($, keywordGroups) {
  let bestTable = null;
  let bestScore = -1;

  $('table').each((_, table) => {
    const firstRow = getDirectRows($, table).first();
    if (!firstRow.length) return;

    const headers = getDirectCells($, firstRow)
      .map((__, cell) => normalizeKey($(cell).text()))
      .get();

    if (!headers.length) return;

    const score = keywordGroups.reduce((total, group) => {
      const matched = group.some(keyword =>
        headers.some(header => header.includes(keyword))
      );
      return total + (matched ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestTable = table;
    }
  });

  return bestScore >= Math.max(2, Math.ceil(keywordGroups.length / 2))
    ? bestTable
    : null;
}

function getColumnIndex(headers, keywords, fallback = -1) {
  const index = headers.findIndex(header =>
    keywords.some(keyword => header.includes(keyword))
  );
  return index >= 0 ? index : fallback;
}

function parseNumericCell(value) {
  const parsed = Number.parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanCourseCode(value = '') {
  return normalizeText(value)
    .replace(/^(\d+\.?\s*)+/, '')
    .replace(/regular/gi, '')
    .trim();
}

function cleanCourseTitle(value = '') {
  return normalizeText(value)
    .split('\u2013')[0]
    .split(' \u2013')[0]
    .split(' -')[0]
    .trim();
}

function looksLikeCourseCode(value = '') {
  const compact = cleanCourseCode(value).replace(/\s+/g, '');
  return /^[A-Z]{2,}\d[A-Z0-9-]*$/i.test(compact);
}

function findCourseCodeCandidate(values = []) {
  return values
    .map(cleanCourseCode)
    .find(value => looksLikeCourseCode(value)) || '';
}

function findCourseTitleCandidate(values = [], excluded = []) {
  const blocked = new Set(excluded.filter(Boolean).map(value => normalizeText(value).toLowerCase()));

  return values
    .map(cleanCourseTitle)
    .find(value => {
      if (!value) return false;
      const normalized = value.toLowerCase();
      if (blocked.has(normalized)) return false;
      if (normalized === 'null') return false;
      if (looksLikeCourseCode(value)) return false;
      return /[a-z]{3}/i.test(value);
    }) || '';
}

function normalizeRoom(value = '') {
  const room = normalizeText(value);
  if (!room) return 'N/A';
  return room.charAt(0).toUpperCase() + room.slice(1);
}

function expandSlotRange(token) {
  const normalized = normalizeText(token).toUpperCase().replace(/[–—]/g, '-');
  const numericRange = normalized.match(/^P(\d+)\s*-\s*P?(\d+)$/i);

  if (!numericRange) return [normalized];

  const start = Number.parseInt(numericRange[1], 10);
  const end = Number.parseInt(numericRange[2], 10);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return [normalized];
  }

  return Array.from({ length: end - start + 1 }, (_, index) => `P${start + index}`);
}

function extractSlotCodes(rawSlot = '') {
  const normalized = normalizeText(rawSlot)
    .replace(/[–—]/g, '-')
    .toUpperCase();

  if (!normalized) return [];

  const parts = normalized
    .split('+')
    .flatMap(part => part.split(','))
    .flatMap(part => part.split('/'))
    .flatMap(part => {
      const trimmed = normalizeText(part);
      if (!trimmed) return [];
      // P1-P5 range → expand to P1,P2,P3,P4,P5
      if (/^P\d+\s*-\s*P?\d+$/i.test(trimmed)) return expandSlotRange(trimmed);
      // Split on - as a delimiter (handles P1-P2-P3-P4-P5 and A-B-C)
      if (trimmed.includes('-')) {
        return trimmed.split(/\s*-\s*/).filter(Boolean);
      }
      return [trimmed];
    })
    .map(part => normalizeText(part))
    .filter(Boolean);

  return [...new Set(parts)];
}

// ═══════════════════════════════════════════════════════════════════════
// SRM ACADEMIA — API-based Login Functions (no Puppeteer needed)
// ═══════════════════════════════════════════════════════════════════════

const SRM_LOGIN_HEADERS = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
  'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'Referer': 'https://academia.srmist.edu.in/accounts/p/10002227248/signin?hide_fp=true&servicename=ZohoCreator&service_language=en&css_url=/49910842/academia-academic-services/downloadPortalCustomCss/login&dcc=true&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2Fportal%2Facademia-academic-services%2FredirectFromLogin',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// Dynamically fetches fresh session cookies and CSRF token from SRM login page
async function getFreshSrmSession() {
  const resp = await fetch(
    'https://academia.srmist.edu.in/accounts/p/10002227248/signin?servicename=ZohoCreator&service_language=en&serviceurl=https%3A%2F%2Facademia.srmist.edu.in',
    { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }, redirect: 'manual' }
  );

  const cookies = resp.headers.getSetCookie()
    .filter(c => !c.includes('Max-Age=0'))
    .map(c => c.split(';')[0]);

  const cookieStr = cookies.join('; ');
  // iamcsr cookie value IS the CSRF token
  const iamcsrMatch = cookieStr.match(/iamcsr=([^;]+)/);
  const csrfToken = iamcsrMatch ? `iamcsrcoo=${iamcsrMatch[1]}` : SRM_CSRF_TOKEN;

  console.log('[SRM] Fresh session cookies obtained, CSRF:', csrfToken.substring(0, 30) + '...');
  return { cookies: cookieStr, csrfToken };
}

async function srmVerifyUser(username) {
  if (!username.includes('@')) {
    username = `${username}@srmist.edu.in`;
  }
  // Always get fresh session cookies for login API
  const session = await getFreshSrmSession();
  const response = await axios(
    `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/lookup/${encodeURIComponent(username)}`,
    {
      method: 'POST',
      headers: {
        ...SRM_LOGIN_HEADERS,
        'x-zcsrf-token': session.csrfToken,
        'cookie': session.cookies,
      },
      data: `mode=primary&cli_time=${Date.now()}&servicename=ZohoCreator&service_language=en&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2Fportal%2Facademia-academic-services%2FredirectFromLogin`,
    }
  );
  const data = response.data;
  return {
    identity: data.lookup?.identifier,
    statusCode: data.status_code,
    message: data.message,
    digest: data.lookup?.digest,
    _session: session, // pass session to next step
  };
}

async function srmVerifyPassword(digest, identifier, password, session) {
  const url = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/primary/${encodeURIComponent(identifier)}/password?digest=${digest}&cli_time=${Date.now()}&servicename=ZohoCreator&service_language=en&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2Fportal%2Facademia-academic-services%2FredirectFromLogin`;

  const loginCookies = session?.cookies || SRM_SESSION_COOKIES;
  const loginCsrf = session?.csrfToken || SRM_CSRF_TOKEN;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...SRM_LOGIN_HEADERS,
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'x-zcsrf-token': loginCsrf,
      'cookie': loginCookies,
    },
    body: JSON.stringify({ passwordauth: { password } }),
    redirect: 'manual',
  });

  const data = await response.json();

  if (data.status_code === 201) {
    const iamttCookies = response.headers.getSetCookie()
      .filter(c => !c.includes('Max-Age=0'))
      .map(c => c.split(';')[0]);
    let allCookies = loginCookies + '; ' + iamttCookies.join('; ');

    // Handle pre-announcement (concurrent session limit)
    const redirectUri = data.passwordauth?.redirect_uri || '';
    if (redirectUri.includes('preannouncement') || redirectUri.includes('block-sessions')) {
      console.log('[SRM] Pre-announcement detected, terminating existing sessions...');
      // DELETE to terminate all existing sessions
      const termResp = await fetch(
        'https://academia.srmist.edu.in/accounts/p/40-10002227248/webclient/v1/announcement/pre/blocksessions',
        {
          method: 'DELETE',
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'x-zcsrf-token': loginCsrf,
            'cookie': allCookies,
          },
        }
      );
      const termData = await termResp.json().catch(() => ({}));
      console.log('[SRM] Terminate sessions result:', termData.message || termData.status_code);

      // Follow block-sessions/next to get real auth cookies
      const nextResp = await fetch(
        'https://academia.srmist.edu.in/accounts/p/40-10002227248/preannouncement/block-sessions/next',
        {
          headers: { 'cookie': allCookies },
          redirect: 'manual',
        }
      );
      const nextCookies = nextResp.headers.getSetCookie()
        .filter(c => !c.includes('Max-Age=0'))
        .map(c => c.split(';')[0]);
      if (nextCookies.length) {
        allCookies = nextCookies.join('; ');
        console.log('[SRM] Got', nextCookies.length, 'session cookies after termination');
      }
    }

    // Follow redirectFromLogin to establish Creator session (get JSESSIONID etc.)
    console.log('[SRM] Establishing Creator session...');
    const creatorResp = await fetch(
      'https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin',
      {
        headers: { 'cookie': allCookies },
        redirect: 'manual',
      }
    );
    const creatorCookies = creatorResp.headers.getSetCookie()
      .filter(c => !c.includes('Max-Age=0'))
      .map(c => c.split(';')[0]);

    // If we got a 302 to /login, follow it to get JSESSIONID
    const creatorLocation = creatorResp.headers.get('location');
    if (creatorLocation) {
      const loginResp = await fetch(
        creatorLocation.startsWith('http') ? creatorLocation : `https://academia.srmist.edu.in${creatorLocation}`,
        {
          headers: { 'cookie': allCookies + '; ' + creatorCookies.join('; ') },
          redirect: 'manual',
        }
      );
      const loginRespCookies = loginResp.headers.getSetCookie()
        .filter(c => !c.includes('Max-Age=0'))
        .map(c => c.split(';')[0]);
      if (loginRespCookies.length) {
        creatorCookies.push(...loginRespCookies);
      }
    }

    if (creatorCookies.length) {
      allCookies += '; ' + creatorCookies.join('; ');
    }

    // Verify we have JSESSIONID
    const hasSession = allCookies.includes('JSESSIONID');
    console.log('[SRM] Creator session established:', hasSession, '| Cookie count:', allCookies.split(';').length);

    return { isAuthenticated: true, cookies: allCookies };
  }

  const captchaRequired = data.localized_message?.toLowerCase()?.includes('captcha') || false;
  return {
    isAuthenticated: false,
    statusCode: data.status_code,
    message: data.localized_message || data.message,
    captcha: captchaRequired
      ? { required: true, digest: data.cdigest }
      : { required: false, digest: null },
  };
}

async function srmGetCaptchaImage(captchaDigest) {
  const response = await fetch(
    `https://academia.srmist.edu.in/accounts/p/40-10002227248/webclient/v1/captcha/${captchaDigest}?darkmode=false`,
    {
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'cookie': SRM_SESSION_COOKIES,
      },
    }
  );
  const data = await response.json();
  return data.captcha;
}

async function srmVerifyWithCaptcha(identifier, digest, captcha, cdigest, password) {
  const url = `https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/primary/${encodeURIComponent(identifier)}/password?digest=${digest}&cli_time=${Date.now()}&servicename=ZohoCreator&service_language=en&serviceurl=https%3A%2F%2Facademia.srmist.edu.in%2Fportal%2Facademia-academic-services%2FredirectFromLogin&captcha=${encodeURIComponent(captcha)}&cdigest=${encodeURIComponent(cdigest)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...SRM_LOGIN_HEADERS,
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'x-zcsrf-token': SRM_CSRF_TOKEN,
      'cookie': SRM_SESSION_COOKIES,
    },
    body: JSON.stringify({ passwordauth: { password } }),
  });

  const data = await response.json();

  if (data.status_code === 201) {
    const cookies = response.headers.getSetCookie()
      .filter(cookie => !cookie.includes('Max-Age=0'))
      .map(cookie => cookie.split(';')[0])
      .join('; ');
    return { isAuthenticated: true, cookies };
  }

  return {
    isAuthenticated: false,
    statusCode: data.status_code,
    message: data.localized_message || data.message,
  };
}

/** Fetches a Zoho Creator Academia page and returns decoded HTML */
async function fetchAcademicPage(authCookie, url) {
  const response = await axios({
    method: 'GET',
    url,
    headers: {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-requested-with': 'XMLHttpRequest',
      'cookie': authCookie,
      'Referer': 'https://academia.srmist.edu.in/',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    timeout: 30000,
  });
  const rawData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  const decodedHtml = decodeAcademicPayload(rawData);
  if (!decodedHtml) {
    throw new Error('Invalid Academia page response — could not decode HTML');
  }
  return decodedHtml;
}

/** Returns the URL for the current academic year's timetable page */
function getTimetableUrls() {
  const base = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Time_Table_';
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const urls = [];

  // Dynamic URL based on current month
  if (month >= 7) {
    urls.push(`${base}${year}_${String(year + 1).slice(-2)}`);
  } else {
    urls.push(`${base}${year - 1}_${String(year).slice(-2)}`);
  }
  // Add fallback URLs for previous years
  for (let y = year - 1; y >= year - 3; y--) {
    const url = `${base}${y}_${String(y + 1).slice(-2)}`;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

/** Fetch timetable page, trying multiple year URLs */
async function fetchTimetablePage(authCookie) {
  const urls = getTimetableUrls();
  for (const url of urls) {
    try {
      const html = await fetchAcademicPage(authCookie, url);
      if (html && html.length > 500 && !html.includes('Page not found')) {
        console.log('[SRM] Timetable loaded from:', url);
        return html;
      }
    } catch (_) {
      // try next URL
    }
  }
  console.log('[SRM] No timetable page found');
  return null;
}

/** Parses courses + student info from timetable page HTML */
function parseCourses(html) {
  const $ = cheerio.load(html);

  const regNumberMatch = html.match(/RA2\d{12}/);
  const regNumber = regNumberMatch ? regNumberMatch[0] : '';

  let batch = '1';
  let studentName = '';
  const infoMap = {};

  $('table').each((_, table) => {
    $(table).find('tr').each((_, row) => {
      const cells = $(row).find('td');
      for (let j = 0; j + 1 < cells.length; j += 2) {
        const key = normalizeKey($(cells[j]).text());
        const value = normalizeText($(cells[j + 1]).text());
        if (key && value && !infoMap[key]) {
          infoMap[key] = value;
        }
      }
    });
  });

  batch = infoMap.batch || batch;
  studentName = infoMap.name || studentName;
  const program = infoMap.program || '';
  const deptRaw = infoMap.department || '';
  const deptParts = deptRaw.split('-');
  const department = deptParts[0]?.trim() || deptRaw;
  const section = deptParts[1]
    ? deptParts[1].replace(/[()]/g, '').replace('Section', '').trim()
    : '';
  const semester = infoMap.semester || '';
  const branch = deriveAcademicBranch(program, department);

  const courses = [];
  const courseTable = $('.course_tbl').first()[0] || findTableByHeaders($, [
    ['course code', 'code'],
    ['course title', 'title', 'subject'],
    ['slot'],
    ['course type', 'type'],
    ['room', 'venue'],
  ]);

  if (!courseTable) {
    return { regNumber, batch, studentName, program, department, section, semester, branch, courses };
  }

  const rows = getDirectRows($, courseTable).toArray();
  if (!rows.length) {
    return { regNumber, batch, studentName, program, department, section, semester, branch, courses };
  }

  const headers = getDirectCells($, rows[0])
    .map((_, cell) => normalizeKey($(cell).text()))
    .get();

  const codeIdx = getColumnIndex(headers, ['course code', 'code'], 1);
  const titleIdx = getColumnIndex(headers, ['course title', 'title', 'subject'], 2);
  const courseTypeIdx = getColumnIndex(headers, ['course type', 'type'], 6);
  const slotIdx = getColumnIndex(headers, ['slot'], 8);
  const roomIdx = getColumnIndex(headers, ['room no', 'room', 'venue'], 10);
  const altRoomIdx = roomIdx === 10 ? 9 : Math.max(roomIdx - 1, 0);

  rows.slice(1).forEach(row => {
    const cells = getDirectCells($, row);
    if (!cells.length) return;

    const values = cells.map((_, cell) => normalizeText($(cell).text())).get();
    const getText = (idx) => (idx >= 0 && idx < values.length ? values[idx] : '');

    const code = cleanCourseCode(getText(codeIdx) || findCourseCodeCandidate(values));
    const title = cleanCourseTitle(
      getText(titleIdx) || findCourseTitleCandidate(values, [code])
    );
    const courseType = getText(courseTypeIdx) || 'N/A';
    const slotCodes = extractSlotCodes(getText(slotIdx));
    const slot = slotCodes.join('+');

    let room = getText(roomIdx);
    if (!room || room.toUpperCase().startsWith('AY')) {
      room = getText(altRoomIdx);
    }

    const slotType = slotCodes.some(slotCode => slotCode.startsWith('P'))
      ? 'Practical'
      : 'Theory';

    if (looksLikeCourseCode(code) && title && slotCodes.length > 0) {
      courses.push({
        code,
        title,
        slot,
        room: normalizeRoom(room),
        slotType,
        courseType,
      });
    }
  });

  return { regNumber, batch, studentName, program, department, section, semester, branch, courses };
}

// Slot-time definitions (10 periods per day)
const SLOT_TIMES = [
  '08:00 - 08:50',
  '08:50 - 09:40',
  '09:45 - 10:35',
  '10:40 - 11:30',
  '11:35 - 12:25',
  '12:30 - 01:20',
  '01:25 - 02:15',
  '02:20 - 03:10',
  '03:10 - 04:00',
  '04:00 - 04:50',
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Slot positions for each day order per batch (index = period index into SLOT_TIMES)
const BATCH_SCHEDULES = {
  '1': [
    ['A', 'A', 'F', 'F', 'G', 'P6', 'P7', 'P8', 'P9', 'P10'],
    ['P11', 'P12', 'P13', 'P14', 'P15', 'B', 'B', 'G', 'G', 'A'],
    ['C', 'C', 'A', 'D', 'B', 'P26', 'P27', 'P28', 'P29', 'P30'],
    ['P31', 'P32', 'P33', 'P34', 'P35', 'D', 'D', 'B', 'E', 'C'],
    ['E', 'E', 'C', 'F', 'D', 'P46', 'P47', 'P48', 'P49', 'P50'],
  ],
  '2': [
    ['P1', 'P2', 'P3', 'P4', 'P5', 'A', 'A', 'F', 'F', 'G'],
    ['B', 'B', 'G', 'G', 'A', 'P16', 'P17', 'P18', 'P19', 'P20'],
    ['P21', 'P22', 'P23', 'P24', 'P25', 'C', 'C', 'A', 'D', 'B'],
    ['D', 'D', 'B', 'E', 'C', 'P36', 'P37', 'P38', 'P39', 'P40'],
    ['P41', 'P42', 'P43', 'P44', 'P45', 'E', 'E', 'C', 'F', 'D'],
  ],
};

/** Maps parsed courses + batch to a flat timetable array */
function buildTimetable(courses, batch) {
  const schedule = BATCH_SCHEDULES[batch] || BATCH_SCHEDULES['1'];

  // Build slot → course mapping (a slot like "A+TA" expands to A and TA)
  const slotMap = {};
  for (const course of courses) {
    const slots = extractSlotCodes(course.slot);
    for (const s of slots) {
      if (!slotMap[s]) slotMap[s] = course;
    }
  }

  const timetable = [];

  for (let dayIdx = 0; dayIdx < schedule.length; dayIdx++) {
    const daySlots = schedule[dayIdx];
    const day = DAY_NAMES[dayIdx];
    const dayOrder = `DO${dayIdx + 1}`;
    let lastCode = null;
    let lastSlotType = null;

    for (let pIdx = 0; pIdx < daySlots.length; pIdx++) {
      const slotCode = daySlots[pIdx];
      const course = slotMap[slotCode];

      if (course) {
        // Determine slot type based on THIS slot code, not course's overall slots
        const currentSlotType = slotCode.startsWith('P') ? 'Practical' : 'Theory';

        if (lastCode === course.code && lastSlotType === currentSlotType && timetable.length > 0) {
          // Extend the last entry's end time (only if same slot type)
          const last = timetable[timetable.length - 1];
          if (last.day === day) {
            last.time = last.time.split(' - ')[0] + ' - ' + SLOT_TIMES[pIdx].split(' - ')[1];
            continue;
          }
        }
        timetable.push({
          day,
          dayOrder,
          time: SLOT_TIMES[pIdx],
          subject: course.title,
          room: course.room,
          courseCode: course.code,
          slotType: currentSlotType,
          courseType: course.courseType,
        });
        lastCode = course.code;
        lastSlotType = currentSlotType;
      } else {
        lastCode = null;
        lastSlotType = null;
      }
    }
  }

  return timetable;
}

/** Parses attendance from the My_Attendance page HTML using multiple strategies */
function parseAttendance(decodedHtml) {
  const regNumberMatch = decodedHtml.match(/RA2\d{12}/);
  const regNumber = regNumberMatch ? regNumberMatch[0] : '';

  // Clean up HTML as per Go logic
  const cleanHtml = decodedHtml.replace(/<td  bgcolor='#E6E6FA' style='text-align:center'> - <\/td>/g, "");
  const $ = cheerio.load(cleanHtml);
  let attendance = [];

  // Strategy 1: Look for table with specific styles (GitHub repo approach)
  const styledTable = $('table[style*="font-size"]').filter((_, el) => {
    const style = $(el).attr('style') || '';
    const bgcolor = $(el).attr('bgcolor') || '';
    return style.includes('16px') && bgcolor.toUpperCase() === '#FAFAD2';
  });

  if (styledTable.length > 0) {
    styledTable.find('tr').slice(1).each((i, row) => {
      const cols = $(row).find('td');
      if (cols.length < 6) return;

      const get = (idx) => cols[idx] ? $(cols[idx]).text().trim() : '';
      const courseCodeRaw = cols[0] ? $(cols[0]).contents().first().text().trim() : '';
      const courseCode = cleanCourseCode(courseCodeRaw);
      const rawTitle = get(1);
      const courseTitle = cleanCourseTitle(rawTitle);

      let slot, conductedNum, absentNum, percentage;

      if (cols.length >= 9) {
        // 9-column layout: Code | Title | Category | Faculty | Slot | Room | Conducted | Absent | Attn%
        slot = get(4);
        conductedNum = parseInt(get(6)) || 0;
        absentNum = parseInt(get(7)) || 0;
        const attStr = cols[8] ? $(cols[8]).find('strong').text().trim() : get(8);
        percentage = parseFloat(attStr) || 0;
      } else {
        // 6-column layout: Code | Title | Category | Faculty | Slot | Attendance
        slot = get(4);
        const attendanceStr = cols[5] ? $(cols[5]).find('strong').text().trim() : get(5);
        const percentMatch = attendanceStr.match(/([\d.]+)/);
        percentage = percentMatch ? parseFloat(percentMatch[1]) : 0;
        const conductedMatch = attendanceStr.match(/(\d+)\s*\/\s*(\d+)/);
        if (conductedMatch) {
          const present = parseInt(conductedMatch[1]) || 0;
          conductedNum = parseInt(conductedMatch[2]) || 0;
          absentNum = conductedNum - present;
        } else {
          conductedNum = 0;
          absentNum = 0;
        }
      }

      // Determine if this is a lab/practical entry based on slot codes
      const slotCodes = extractSlotCodes(slot);
      const slotType = slotCodes.some(s => s.startsWith('P')) ? 'Practical' : 'Theory';

      if (courseCode && courseTitle && courseTitle.toLowerCase() !== 'null') {
        attendance.push({
          courseCode,
          courseTitle,
          slot,
          slotType,
          hoursConducted: String(conductedNum),
          hoursAbsent: String(absentNum),
          attendancePercentage: percentage.toFixed(2),
        });
      }
    });
  }

  // Strategy 2: Original approach with bgcolor='#E6E6FA' cells (if Strategy 1 found nothing)
  if (attendance.length === 0) {
    $("td[bgcolor='#E6E6FA']").each((i, el) => {
      const cell = $(el);
      const text = cell.text().trim();

      // Pattern: starts with digit and length > 10 OR contains "Regular"
      if (/^\d/.test(text) || text.length > 10 || text.toLowerCase().includes("regular")) {
        const cells = cell.nextAll();

        const courseCode = cleanCourseCode(text);
        const rawTitle = cells.eq(0).text().trim();
        const courseTitle = cleanCourseTitle(rawTitle);
        const slot = cells.eq(3).text().trim();
        const conducted = cells.eq(5).text().trim();
        const absent = cells.eq(6).text().trim();

        const conductedNum = parseFloat(conducted) || 0;
        const absentNum = parseFloat(absent) || 0;
        let percentage = conductedNum > 0 ? (((conductedNum - absentNum) / conductedNum) * 100) : 0;

        const slotCodes = extractSlotCodes(slot);
        const slotType = slotCodes.some(s => s.startsWith('P')) ? 'Practical' : 'Theory';

        if (courseCode && courseTitle && courseTitle.toLowerCase() !== 'null') {
          attendance.push({
            courseCode,
            courseTitle,
            slot,
            slotType,
            hoursConducted: String(conductedNum),
            hoursAbsent: String(absentNum),
            attendancePercentage: percentage.toFixed(2),
          });
        }
      }
    });
  }

  // Strategy 3: Generic table approach for newer layouts
  if (attendance.length === 0) {
    $('table').each((_, table) => {
      const rows = $(table).find('tr');
      const headerRow = rows.first();
      const headers = headerRow.find('th, td').map((_, cell) => normalizeKey($(cell).text())).get();

      // Check if this looks like an attendance table
      const hasCode = headers.some(h => h.includes('code') || h.includes('course'));
      const hasAttendance = headers.some(h => h.includes('attendance') || h.includes('percent'));

      if (hasCode && hasAttendance && attendance.length === 0) {
        rows.slice(1).each((_, row) => {
          const cols = $(row).find('td');
          if (cols.length < 4) return;

          const values = cols.map((_, cell) => $(cell).text().trim()).get();
          const courseCode = cleanCourseCode(values[0] || values[1] || '');
          const courseTitle = cleanCourseTitle(values[1] || values[2] || '');

          // Find attendance percentage in the row
          let percentage = 0;
          for (const val of values) {
            const match = val.match(/([\d.]+)\s*%/);
            if (match) {
              percentage = parseFloat(match[1]);
              break;
            }
          }

          if (courseCode && courseTitle && percentage > 0) {
            attendance.push({
              courseCode,
              courseTitle,
              slot: 'N/A',
              slotType: 'Theory',
              hoursConducted: '0',
              hoursAbsent: '0',
              attendancePercentage: percentage.toFixed(2),
            });
          }
        });
      }
    });
  }

  return { regNumber, attendance };
}

/** Parses marks from the My_Attendance page HTML using multiple strategies */
function parseMarks(decodedHtml, attendanceData = []) {
  const $ = cheerio.load(decodedHtml);
  let marksDetails = [];

  // Build names map from attendance
  const nameMap = {};
  attendanceData.forEach(a => {
    nameMap[a.courseCode] = a.courseTitle;
  });

  // Strategy 1: Look for table[border='1'][align='center'] (original pattern)
  $("table[border='1'][align='center']").each((i, table) => {
    // Skip the attendance table (bgcolor=#FAFAD2)
    if ($(table).attr('bgcolor')?.toUpperCase() === '#FAFAD2') return;

    $(table).find("tr").each((j, row) => {
      const cells = $(row).find("> td");
      if (cells.length < 3) return;

      const courseCode = cells.eq(0).text().trim();
      const courseType = cells.eq(1).text().trim();
      const marksTable = cells.eq(2).find("table");

      if (!courseCode || !courseType || marksTable.length === 0) return;
      // Skip header rows
      if (courseCode.toLowerCase().includes('course code')) return;

      const testPerformance = [];
      let overallScored = 0;
      let overallTotal = 0;

      marksTable.find("td").each((k, testCell) => {
        const $cell = $(testCell);
        const strongText = $cell.find('strong').text().trim();
        if (!strongText || !strongText.includes('/')) return;

        const [examName, maxStr] = strongText.split('/');
        const maxMark = parseFloat(maxStr) || 0;
        // Get the obtained score: full cell text minus the strong text
        const obtained = $cell.text().replace(strongText, '').trim().replace(/^\n+|\n+$/g, '');
        const obtainedNum = obtained === 'Abs' ? 0 : (parseFloat(obtained) || 0);

        testPerformance.push({
          exam: examName.trim(),
          obtained: obtainedNum,
          maxMark,
        });
        overallScored += obtainedNum;
        overallTotal += maxMark;
      });

      if (testPerformance.length > 0) {
        marksDetails.push({
          course: nameMap[courseCode] || courseCode,
          courseCode,
          category: courseType,
          marks: testPerformance,
          total: {
            obtained: Number(overallScored.toFixed(2)),
            maxMark: Number(overallTotal.toFixed(2))
          }
        });
      }
    });
  });

  // Strategy 2: GitHub repo approach - table:nth-child(7)
  if (marksDetails.length === 0) {
    const table = $('table:nth-child(7)');
    table.find('tr').each((i, row) => {
      if (i === 0) return; // Skip header
      const cols = $(row).find('td');
      const course = $(cols[0]).text().trim();
      const category = $(cols[1]).text().trim();
      const marksTable = $(cols[2]).find('table');

      if (!course || !category || marksTable.length === 0) return;

      const marks = [];
      let total = { obtained: 0, maxMark: 0 };

      marksTable.find('td').each((j, markTd) => {
        const strongText = $(markTd).find('strong').text().trim();
        const [type, max] = strongText.split('/');
        const obtained = $(markTd).text().replace(strongText, '').trim().replace(/^\n+|\n+$/g, '');

        if (type && max) {
          const obtainedNum = obtained === 'Abs' ? 0 : (parseFloat(obtained) || 0);
          const maxNum = parseFloat(max) || 0;
          marks.push({
            exam: type.trim(),
            obtained: obtainedNum,
            maxMark: maxNum
          });
          total.obtained += obtainedNum;
          total.maxMark += maxNum;
        }
      });

      if (marks.length > 0) {
        marksDetails.push({
          course: nameMap[course] || course,
          courseCode: course,
          category,
          marks,
          total: {
            obtained: Number(total.obtained.toFixed(2)),
            maxMark: Number(total.maxMark.toFixed(2))
          }
        });
      }
    });
  }

  // Strategy 3: Look for any nested table structure with marks
  if (marksDetails.length === 0) {
    $('table').each((_, outerTable) => {
      $(outerTable).find('tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;

        // Look for cells that contain nested tables with marks data
        cells.each((_, cell) => {
          const nestedTable = $(cell).find('table');
          if (nestedTable.length === 0) return;

          const marks = [];
          let total = { obtained: 0, maxMark: 0 };

          nestedTable.find('td').each((_, td) => {
            const text = $(td).text().trim();
            // Pattern: "ExamName/MaxMark Score" or "ExamName/MaxMark\nScore"
            const match = text.match(/([A-Za-z0-9\s]+)\/([\d.]+)\s*([\d.]+|Abs)?/);
            if (match) {
              const exam = match[1].trim();
              const maxMark = parseFloat(match[2]) || 0;
              const obtained = match[3] === 'Abs' ? 0 : (parseFloat(match[3]) || 0);

              marks.push({ exam, obtained, maxMark });
              total.obtained += obtained;
              total.maxMark += maxMark;
            }
          });

          if (marks.length > 0) {
            // Try to get course info from sibling cells
            const courseCode = $(cells[0]).text().trim() || 'Unknown';
            const category = $(cells[1]).text().trim() || 'N/A';

            marksDetails.push({
              course: nameMap[courseCode] || courseCode,
              courseCode,
              category,
              marks,
              total: {
                obtained: Number(total.obtained.toFixed(2)),
                maxMark: Number(total.maxMark.toFixed(2))
              }
            });
          }
        });
      });
    });
  }

  return marksDetails;
}

/** Fetches raw (undecoded) page data from SRM Academia — used by scraper-style parsers */
async function fetchRawAcademicPage(authCookie, url) {
  const response = await axios({
    method: 'GET',
    url,
    headers: {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-requested-with': 'XMLHttpRequest',
      'cookie': authCookie,
      'Referer': 'https://academia.srmist.edu.in/',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    timeout: 30000,
  });
  return response.data;
}

/** Gets the course/timetable dynamic URL for the current academic year */
function getCourseDynamicUrl() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let yearString;
  if (month >= 7) {
    yearString = `${year}_${String(year + 1).slice(-2)}`;
  } else {
    yearString = `${year - 1}_${String(year).slice(-2)}`;
  }
  return `https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Time_Table_${yearString}`;
}

/** Gets the academic calendar dynamic URL */
function getCalendarDynamicUrl() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let yearString, semType;
  if (month >= 1 && month <= 6) {
    semType = 'EVEN';
    yearString = `${year - 1}_${String(year).slice(-2)}`;
  } else {
    semType = 'ODD';
    yearString = `${year}_${String(year + 1).slice(-2)}`;
  }
  return `https://academia.srmist.edu.in/srm_university/academia-academic-services/page/Academic_Planner_${yearString}_${semType}`;
}

/** Scraper-style attendance parser: works on raw pageSanitizer response */
function parseSrmAttendance(rawResponse) {
  const match = rawResponse.match(/pageSanitizer\.sanitize\('(.*)'\);/s);
  if (!match || !match[1]) return { error: 'Failed to extract attendance data', status: 500 };

  const decodedHtml = match[1]
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\/g, '')
    .replace(/\\'/g, "'");

  const $ = cheerio.load(decodedHtml, { decodeEntities: true, lowerCaseTags: true, xmlMode: false });
  const table = $('table[style*="font-size :16px;"][bgcolor="#FAFAD2"]');
  const rows = table.find('tr').slice(1).toArray();

  const attendance = rows.map(row => {
    const cols = $(row).find('td');
    const get = (idx) => cols[idx] ? $(cols[idx]).text().trim() : '';
    return {
      courseCode: cols[0] ? $(cols[0]).contents().first().text().trim() : '',
      courseType: cols[0] ? $(cols[0]).find('font').text().trim() : '',
      courseTitle: get(1),
      courseCategory: get(2),
      courseFaculty: get(3).split('(')[0].trim(),
      courseSlot: get(4),
      courseAttendance: cols[5] ? $(cols[5]).find('strong').text().trim() : '',
    };
  });

  return { attendance, status: 200 };
}

/** Scraper-style marks parser: works on raw pageSanitizer response */
function parseSrmMarks(rawResponse) {
  const match = rawResponse.match(/pageSanitizer\.sanitize\('(.*)'\);/s);
  if (!match || !match[1]) return { error: 'Failed to extract marks data', status: 500 };

  const decodedHtml = match[1]
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\/g, '')
    .replace(/\\'/g, "'");

  const $ = cheerio.load(decodedHtml);
  const table = $('table:nth-child(7)');
  const marksDetails = [];
  const tableRows = table.find('tr');

  tableRows.each((i, row) => {
    if (i === 0) return;
    const cols = $(row).find('td');
    const course = $(cols[0]).text().trim();
    const category = $(cols[1]).text().trim();
    const marksTable = $(cols[2]).find('table');
    if (!course || !category || marksTable.length === 0) return;

    const marks = [];
    let total = { obtained: 0, maxMark: 0 };
    marksTable.find('td').each((j, markTd) => {
      const strongText = $(markTd).find('strong').text().trim();
      const [type, max] = strongText.split('/');
      const obtained = $(markTd).text().replace(strongText, '').trim().replace(/^\n+|\n+$/g, '');
      if (type && max) {
        marks.push({ exam: type.trim(), obtained, maxMark: max.trim() });
      }
      const obtainedNum = parseFloat(obtained);
      if (!isNaN(obtainedNum)) total.obtained += obtainedNum;
      const maxNum = parseFloat(max);
      if (!isNaN(maxNum)) total.maxMark += maxNum;
    });

    total.obtained = Number(total.obtained.toFixed(2));
    total.maxMark = Number(total.maxMark.toFixed(2));
    marksDetails.push({ course, category, marks, total });
  });

  return { markList: marksDetails, status: 200 };
}

/** Scraper-style course parser: works on raw pageSanitizer response */
function parseSrmCourseDetails(rawResponse) {
  const match = rawResponse.match(/pageSanitizer\.sanitize\('(.*)'\);/s);
  if (!match || !match[1]) return { error: 'Failed to extract course details', status: 500 };

  const decodedHtml = match[1]
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\/g, '')
    .replace(/\\'/g, "'");

  const $ = cheerio.load(decodedHtml, { decodeEntities: true, lowerCaseTags: true, xmlMode: false });

  let batch = '';
  try { batch = $("td:contains('Batch:')").next('td').find('font').text().trim(); } catch (_) {}

  const courseList = Array.from($('.course_tbl tr').slice(1)).map(row => {
    const columns = $(row).find('td');
    const get = (idx) => columns[idx] ? $(columns[idx]).text().trim() : '';
    const slotRaw = get(8);
    const courseSlot = slotRaw ? slotRaw.split('-').map(s => s.trim()).filter(Boolean) : [];
    return {
      courseCode: get(1),
      courseTitle: get(2),
      courseCredit: get(3),
      courseCategory: get(4),
      courseType: get(5),
      courseFaculty: get(7),
      courseSlot,
      courseRoomNo: get(9),
    };
  });

  return { courseList, batch, status: 200 };
}

/** Scraper-style timetable parser: works on raw pageSanitizer response */
function parseSrmTimetable(rawResponse) {
  const match = rawResponse.match(/pageSanitizer\.sanitize\('(.*)'\);/s);
  if (!match || !match[1]) return { error: 'Failed to extract timetable data', status: 500 };

  const decodedHtml = match[1]
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\/g, '')
    .replace(/\\'/g, "'");

  const $ = cheerio.load(decodedHtml, { decodeEntities: true, lowerCaseTags: true, xmlMode: false });

  const batch = $("td:contains('Batch:')").next('td').find('font').text().trim();
  const courseList = Array.from($('.course_tbl tr').slice(1)).map(row => {
    const columns = $(row).find('td');
    const get = (idx) => columns[idx] ? $(columns[idx]).text().trim() : '';
    const slotRaw = get(8);
    const courseSlot = slotRaw ? slotRaw.split('-').map(s => s.trim()).filter(Boolean) : [];
    return {
      courseCode: get(1),
      courseTitle: get(2),
      courseCredit: get(3),
      courseCategory: get(4),
      courseType: get(5),
      courseFaculty: get(7),
      courseSlot,
      courseRoomNo: get(9),
    };
  });

  // Slot-time mapping data
  const srmSlotTimes = [
    '08:00 AM - 08:50 AM', '08:50 AM - 09:40 AM', '09:45 AM - 10:35 AM',
    '10:40 AM - 11:30 AM', '11:35 AM - 12:25 PM', '12:30 PM - 01:20 PM',
    '01:25 PM - 02:15 PM', '02:20 PM - 03:10 PM', '03:10 PM - 04:00 PM',
    '04:00 PM - 04:50 PM',
  ];
  const srmBatchSlots = {
    '1': {
      slots: [
        { dayOrder: 'Day 1', slots: ['A','A','F','F','G','P6','P7','P8','P9','P10'], time: srmSlotTimes },
        { dayOrder: 'Day 2', slots: ['P11','P12','P13','P14','P15','B','B','G','G','A'], time: srmSlotTimes },
        { dayOrder: 'Day 3', slots: ['C','C','A','D','B','P26','P27','P28','P29','P30'], time: srmSlotTimes },
        { dayOrder: 'Day 4', slots: ['P31','P32','P33','P34','P35','D','D','B','E','C'], time: srmSlotTimes },
        { dayOrder: 'Day 5', slots: ['E','E','C','F','D','P46','P47','P48','P49','P50'], time: srmSlotTimes },
      ],
    },
    '2': {
      slots: [
        { dayOrder: 'Day 1', slots: ['P1','P2','P3','P4','P5','A','A','F','F','G'], time: srmSlotTimes },
        { dayOrder: 'Day 2', slots: ['B','B','G','G','A','P16','P17','P18','P19','P20'], time: srmSlotTimes },
        { dayOrder: 'Day 3', slots: ['P21','P22','P23','P24','P25','C','C','A','D','B'], time: srmSlotTimes },
        { dayOrder: 'Day 4', slots: ['D','D','B','E','C','P36','P37','P38','P39','P40'], time: srmSlotTimes },
        { dayOrder: 'Day 5', slots: ['P41','P42','P43','P44','P45','E','E','C','F','D'], time: srmSlotTimes },
      ],
    },
  };

  const batchData = srmBatchSlots[batch] || srmBatchSlots['1'];
  const slotMap = {};
  courseList.forEach(course => {
    course.courseSlot.forEach(slot => {
      if (slot) {
        slotMap[slot] = {
          courseTitle: course.courseTitle,
          courseCode: course.courseCode,
          courseCategory: course.courseCategory,
          courseRoomNo: course.courseRoomNo,
        };
      }
    });
  });

  const timetable = batchData.slots.map(day => ({
    dayOrder: day.dayOrder,
    class: day.slots.map((slot, i) => {
      const info = slotMap[slot];
      return {
        slot,
        isClass: !!info,
        ...(info ? {
          courseTitle: info.courseTitle,
          courseCode: info.courseCode,
          courseCategory: info.courseCategory,
          courseRoomNo: info.courseRoomNo,
        } : {}),
        time: day.time[i],
      };
    }),
  }));

  return { timetable, status: 200 };
}

/** Scraper-style calendar parser */
function parseSrmCalendar(rawResponse) {
  const $outer = cheerio.load(rawResponse, { decodeEntities: true, lowerCaseTags: true, xmlMode: false });
  const zmlValue = $outer('div.zc-pb-embed-placeholder-content').attr('zmlvalue');
  if (!zmlValue) return { error: 'Could not find calendar data', status: 500 };

  const $inner = cheerio.load(zmlValue, { decodeEntities: true, lowerCaseTags: true, xmlMode: false });
  const $mainTable = $inner("table[bgcolor='#FAFCFE']");
  if ($mainTable.length === 0) return { error: 'Could not find calendar table', status: 500 };

  const $headerRow = $mainTable.find('tr').first();
  const $ths = $headerRow.find('th');
  const monthsData = [];
  for (let i = 0; ; i++) {
    const idx = i * 5 + 2;
    if (idx >= $ths.length) break;
    const monthName = $ths.eq(idx).find('strong').text().trim();
    if (monthName) monthsData.push({ month: monthName, days: [] });
    else break;
  }

  $mainTable.find('tr').slice(1).toArray().forEach(rowEl => {
    const $tds = $inner(rowEl).find('td');
    monthsData.forEach((month, mi) => {
      const offset = mi * 5;
      if (offset + 3 >= $tds.length) return;
      const date = $tds.eq(offset).text().trim();
      if (!date) return;
      month.days.push({
        date,
        day: $tds.eq(offset + 1).text().trim(),
        event: $tds.eq(offset + 2).find('strong').text().trim(),
        dayOrder: $tds.eq(offset + 3).text().trim(),
      });
    });
  });

  return { calendar: monthsData, status: 200 };
}

/** Scraper-style user info parser */
function parseSrmUserInfo(rawResponse) {
  const match = rawResponse.match(/pageSanitizer\.sanitize\('(.*)'\);/s);
  if (!match || !match[1]) return { error: 'Failed to extract user details', status: 500 };

  const decodedHtml = match[1]
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\\/g, '')
    .replace(/\\'/g, "'");

  const $ = cheerio.load(decodedHtml, { decodeEntities: true, lowerCaseTags: true, xmlMode: false });
  const getText = (sel) => $(sel).text().trim();

  const infoMap = {};
  $('table').each((_, table) => {
    $(table).find('tr').each((__, row) => {
      const cells = $(row).find('td');
      for (let index = 0; index + 1 < cells.length; index += 2) {
        const key = normalizeKey($(cells[index]).text());
        const value = normalizeText($(cells[index + 1]).text());
        if (key && value && !infoMap[key]) {
          infoMap[key] = value;
        }
      }
    });
  });

  const deptRaw = infoMap.department || getText('td:contains("Department:") + td strong');
  const deptParts = deptRaw.split('-');
  const program = infoMap.program || getText('td:contains("Program:") + td strong');
  const department = deptParts[0]?.trim() || deptRaw;

  const userInfo = {
    regNumber: infoMap['registration number'] || getText('td:contains("Registration Number:") + td strong'),
    name: infoMap.name || getText('td:contains("Name:") + td strong'),
    mobile: infoMap.mobile || getText('td:contains("Mobile:") + td strong'),
    program,
    department,
    section: deptParts[1] ? deptParts[1].replace(/[()]/g, '').replace('Section', '').trim() : '',
    semester: infoMap.semester || getText('td:contains("Semester:") + td strong'),
    batch: infoMap.batch || getText('td:contains("Batch:") + td strong'),
    branch: deriveAcademicBranch(program, department),
  };

  return { userInfo, status: 200 };
}

/** Fetches real attendance and marks in a coordinated way */
async function fetchRealAcademicData(authCookie) {
  const url = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance';
  const html = await fetchAcademicPage(authCookie, url);
  
  const attResult = parseAttendance(html);
  const marks = parseMarks(html, attResult.attendance);
  
  return { ...attResult, marks };
}

/** Fetches real timetable using the stored academia cookie */
async function fetchRealTimetable(authCookie) {
  const html = await fetchTimetablePage(authCookie);
  if (!html) {
    return {
      timetable: [], regNumber: '', batch: '', studentName: '',
      program: '', department: '', section: '', semester: '', branch: '',
    };
  }
  const { regNumber, batch, studentName, program, department, section, semester, branch, courses } = parseCourses(html);
  const timetable = buildTimetable(courses, batch);
  return { timetable, regNumber, batch, studentName, program, department, section, semester, branch };
}

/** Fetches current day order from Academia homepage */
async function fetchCurrentDayOrder(authCookie) {
  try {
    const homeUrl = 'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/';
    const html = await fetchAcademicPage(authCookie, homeUrl);

    if (!html) return null;

    // Look for day order in the HTML - it's usually displayed as "Day Order: DO1" or similar
    const dayOrderMatch = html.match(/Day\s*Order\s*[:\-]?\s*(DO\d)/i);
    if (dayOrderMatch) {
      return dayOrderMatch[1]; // Returns "DO1", "DO2", etc.
    }

    // Alternative pattern: just "DO1" or "DO 1"
    const altMatch = html.match(/\b(DO\s*\d)\b/i);
    if (altMatch) {
      return altMatch[1].replace(/\s+/, ''); // Returns "DO1"
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch day order:', error);
    return null;
  }
}


const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (req, res) => {
  res.send('<h1>LockedIn API is Running</h1><p>Frontend should be deployed separately with the <b>frontend</b> root directory.</p>');
});

const INTERVIEW_LIBRARY = {
  hr: {
    label: 'HR',
    opening: 'I will assess communication, self-awareness, and professional clarity.',
    questions: [
      'Tell me about yourself in under two minutes.',
      'Why should we hire you over another student with similar grades?',
      'Describe a time you handled pressure or a setback.',
      'What kind of team environment helps you do your best work?',
      'Where do you see yourself in the next two years?',
    ],
    focusAreas: ['communication', 'clarity', 'ownership', 'motivation'],
  },
  technical: {
    label: 'Technical',
    opening: 'I will test problem-solving, depth, and the way you explain technical tradeoffs.',
    questions: [
      'Explain the difference between a process and a thread with one practical example.',
      'When would you choose a hash map over a balanced tree?',
      'How would you design a scalable job tracking system for students?',
      'What happens internally when you type a URL into a browser?',
      'Explain one project decision where you traded simplicity for scalability.',
    ],
    focusAreas: ['technical depth', 'problem solving', 'tradeoffs', 'examples'],
  },
  resume: {
    label: 'Resume',
    opening: 'I will ask targeted questions that convert project bullets into measurable impact.',
    questions: [
      'Pick one project from your resume and explain the real problem it solves.',
      'What was the hardest bug or blocker in that project, and how did you fix it?',
      'Which metric improved because of your work, and how do you know?',
      'If I asked your teammate about your contribution, what would they say?',
      'What would you improve in that project if you had one more week?',
    ],
    focusAreas: ['impact', 'ownership', 'metrics', 'execution'],
  },
  company: {
    label: 'Company-Specific',
    opening: 'I will simulate a company-style round and look for structured, confident answers.',
    questions: [
      'Why do you want to work at this company specifically?',
      'How would your strengths fit this company’s engineering culture?',
      'Tell me about a project that proves you can handle ambiguity.',
      'If assigned an unfamiliar stack on day one, how would you ramp up quickly?',
      'What kind of problems do you want to solve here and why?',
    ],
    focusAreas: ['company fit', 'research', 'adaptability', 'motivation'],
  },
};

function getInterviewConfig(mode) {
  return INTERVIEW_LIBRARY[mode] || INTERVIEW_LIBRARY.hr;
}

function createInterviewPrompt({
  stage,
  mode,
  companyName,
  studentData,
  history,
  answer,
  questionIndex,
}) {
  const config = getInterviewConfig(mode);
  const companyContext = companyName ? `Target company: ${companyName}.` : 'No specific company selected.';
  const resumeStr = studentData?.resumeContext ? `\nCandidate Resume/Project Context:\n${studentData.resumeContext}\n` : '';

  if (stage === 'start') {
    let focusInstruction = `Ask the first interview question only. Keep it natural, under 35 words, and aligned to these themes: ${config.focusAreas.join(', ')}.`;
    if (mode === 'resume' && studentData?.resumeContext) {
      focusInstruction = `Ask the first interview question specifically based on the provided Candidate Resume/Project Context above. Ask them to build upon or explain a specific detail. Keep it natural, under 35 words.`;
    }

    return `You are LockedIn Interviewer, a precise but encouraging mock interviewer.
Interview mode: ${config.label}.
${companyContext}${resumeStr}
Student profile: ${JSON.stringify(studentData || {})}

${focusInstruction}
Do not include analysis or bullet points.`;
  }

  let followUpInstruction = ``;
  if (mode === 'resume' && studentData?.resumeContext) {
     followUpInstruction = `For your 'followUpQuestion', ask a specific question based on details in the Candidate Resume/Project Context.`;
  }

  return `You are LockedIn Interviewer, a precise mock interviewer.
Interview mode: ${config.label}.
${companyContext}${resumeStr}
Student profile: ${JSON.stringify(studentData || {})}
Current question number: ${questionIndex + 1}.
Conversation so far: ${JSON.stringify(history || [])}
Candidate answer: ${answer}

Return strict JSON with this shape:
{
  "score": number,
  "communication": number,
  "technicalDepth": number,
  "confidence": number,
  "strengths": ["..."],
  "gaps": ["..."],
  "feedback": "short paragraph",
  "idealAnswer": "short paragraph",
  "followUpQuestion": "one question",
  "shouldEnd": boolean
}

Scoring rules:
- Scores must be 0-100
- Be honest, not generous
- Prefer concrete feedback
- Set shouldEnd true after 4-5 rounds or when the answer is too weak to continue naturally
${followUpInstruction}`;
}

async function runChatCompletion(messages, options = {}) {
  const LLM_API_KEY = process.env.LLM_API_KEY;
  const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.mistral.ai/v1';
  const LLM_MODEL = process.env.LLM_MODEL || 'mistral-tiny';

  if (!LLM_API_KEY) {
    return null;
  }

  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
      response_format: options.response_format,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    const message = data?.error?.message || 'Unknown LLM error';
    throw new Error(message);
  }

  return data.choices?.[0]?.message?.content || null;
}

const PLACEMENT_BRANCH_PROFILES = {
  CSE: {
    label: 'Computer Science and Engineering',
    targetRoles: ['Software Engineer', 'Backend Developer', 'Full Stack Developer', 'SDE Intern'],
    skills: ['Data Structures and Algorithms', 'DBMS and SQL', 'OS and Computer Networks', 'Full-stack project delivery'],
  },
  ECE: {
    label: 'Electronics and Communication Engineering',
    targetRoles: ['Embedded Engineer', 'VLSI Intern', 'IoT Engineer', 'Core Electronics Trainee'],
    skills: ['Digital electronics', 'Signals and communication systems', 'Embedded C and microcontrollers', 'Problem solving for campus rounds'],
  },
  EEE: {
    label: 'Electrical and Electronics Engineering',
    targetRoles: ['Electrical Design Engineer', 'Power Systems Graduate Engineer', 'Automation Engineer', 'Core Operations Trainee'],
    skills: ['Electrical machines and power systems', 'Control systems', 'MATLAB and simulation basics', 'Aptitude and interview fundamentals'],
  },
  MECH: {
    label: 'Mechanical Engineering',
    targetRoles: ['Graduate Engineer Trainee', 'Design Engineer', 'Manufacturing Engineer', 'Operations Analyst'],
    skills: ['Thermodynamics and SOM', 'CAD and design thinking', 'Manufacturing processes', 'Analytical problem solving'],
  },
  CIVIL: {
    label: 'Civil Engineering',
    targetRoles: ['Site Engineer', 'Structural Design Trainee', 'Planning Engineer', 'Project Coordinator'],
    skills: ['Structural analysis basics', 'Surveying and estimation', 'AutoCAD and project planning', 'Quantitative reasoning'],
  },
};

const PLACEMENT_BRANCH_KEYWORDS = {
  CSE: ['computer', 'software', 'programming', 'coding', 'data science', 'dbms', 'cloud', 'devops', 'operating system', 'network'],
  ECE: ['electronics', 'communication', 'digital electronics', 'signals', 'embedded', 'vlsi', 'microprocessor', 'iot'],
  EEE: ['electrical', 'power system', 'machines', 'control system', 'circuit', 'power electronics'],
  MECH: ['mechanical', 'thermodynamics', 'manufacturing', 'som', 'design', 'cad', 'fluid mechanics'],
  CIVIL: ['civil', 'structural', 'surveying', 'concrete', 'geotechnical', 'transportation', 'estimation'],
};

function inferBranchFromKeywords(text = '') {
  const normalized = String(text || '').toLowerCase();
  let bestBranch = null;
  let bestScore = 0;

  for (const [branch, keywords] of Object.entries(PLACEMENT_BRANCH_KEYWORDS)) {
    const score = keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestBranch = branch;
    }
  }

  return bestScore > 0 ? { branch: bestBranch, score: bestScore } : null;
}

function inferPlacementBranch(studentData = {}, requestedBranch = '') {
  const normalizedRequested = String(requestedBranch || '').trim().toUpperCase();
  if (PLACEMENT_BRANCH_PROFILES[normalizedRequested]) {
    return normalizedRequested;
  }

  const profileText = `${studentData?.program || ''} ${studentData?.department || ''}`.toLowerCase();

  if (/\bcse\b/.test(profileText)) return 'CSE';
  if (/\bece\b/.test(profileText)) return 'ECE';
  if (/\beee\b/.test(profileText)) return 'EEE';
  if (/\bmech\b/.test(profileText)) return 'MECH';

  const directProfileMatch = inferBranchFromKeywords(profileText);
  if (directProfileMatch?.score) {
    return directProfileMatch.branch;
  }

  const subjectText = Array.isArray(studentData?.timetable)
    ? studentData.timetable.map(item => item?.subject || '').join(' | ')
    : '';
  const subjectMatch = inferBranchFromKeywords(subjectText);
  if (subjectMatch?.score >= 2) {
    return subjectMatch.branch;
  }

  return 'CSE';
}

function parsePlacementMinutes(timeStr) {
  const value = String(timeStr || '').trim();
  if (!value) return null;

  const match = value.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem) {
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    return hours * 60 + minutes;
  }

  if (hours >= 1 && hours <= 6) {
    hours += 12;
  }

  return hours * 60 + minutes;
}

function formatPlacementMinutes(totalMinutes) {
  const normalizedHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = normalizedHours >= 12 ? 'PM' : 'AM';
  const hours12 = normalizedHours % 12 || 12;

  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function parsePlacementTimeWindow(timeStr) {
  const parts = String(timeStr || '').split(' - ').map(part => part.trim());
  if (parts.length !== 2) return null;

  const startMinutes = parsePlacementMinutes(parts[0]);
  const endMinutes = parsePlacementMinutes(parts[1]);

  if (startMinutes == null || endMinutes == null) {
    return null;
  }

  return { startMinutes, endMinutes };
}

function buildPlacementWindow(group, fromMinutes, toMinutes, type) {
  const durationMinutes = toMinutes - fromMinutes;
  if (durationMinutes <= 30) {
    return null;
  }

  const label = group.dayOrder ? `${group.dayOrder} · ${group.day}` : group.day;

  return {
    day: group.day,
    dayOrder: group.dayOrder || null,
    label,
    from: formatPlacementMinutes(fromMinutes),
    to: formatPlacementMinutes(toMinutes),
    durationMinutes,
    durationHours: Number((durationMinutes / 60).toFixed(1)),
    type,
  };
}

function getPlacementGroupOrder(group) {
  const match = String(group.dayOrder || '').match(/DO(\d+)/i);
  if (match) return Number.parseInt(match[1], 10);

  const weekdayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const index = weekdayOrder.indexOf(group.day);
  return index >= 0 ? index + 1 : Number.MAX_SAFE_INTEGER;
}

function analyzePlacementSchedule(timetable = []) {
  const groupedDays = new Map();

  for (const entry of timetable) {
    if (!entry?.time) continue;
    const groupKey = entry.dayOrder || entry.day || 'Schedule';
    if (!groupedDays.has(groupKey)) {
      groupedDays.set(groupKey, {
        day: entry.day || groupKey,
        dayOrder: entry.dayOrder || null,
        classes: [],
      });
    }
    groupedDays.get(groupKey).classes.push(entry);
  }

  const groups = [...groupedDays.values()].sort((a, b) => getPlacementGroupOrder(a) - getPlacementGroupOrder(b));
  const freeWindows = [];

  for (const group of groups) {
    const classes = group.classes
      .map(item => ({ ...item, window: parsePlacementTimeWindow(item.time) }))
      .filter(item => item.window)
      .sort((a, b) => a.window.startMinutes - b.window.startMinutes);

    if (classes.length === 0) continue;

    const first = classes[0].window;
    const last = classes[classes.length - 1].window;

    const morningWindow = buildPlacementWindow(group, 8 * 60, first.startMinutes, 'morning');
    if (morningWindow) freeWindows.push(morningWindow);

    for (let index = 0; index < classes.length - 1; index += 1) {
      const current = classes[index].window;
      const next = classes[index + 1].window;
      const gapWindow = buildPlacementWindow(group, current.endMinutes, next.startMinutes, 'gap');
      if (gapWindow) freeWindows.push(gapWindow);
    }

    const eveningWindow = buildPlacementWindow(group, last.endMinutes, 18 * 60, 'evening');
    if (eveningWindow) freeWindows.push(eveningWindow);
  }

  return freeWindows;
}

function summarizePlacementWindows(freeWindows = []) {
  const grouped = new Map();

  for (const window of freeWindows) {
    const key = window.dayOrder || window.day;
    if (!grouped.has(key)) {
      grouped.set(key, {
        day: window.day,
        dayOrder: window.dayOrder,
        label: window.label,
        availableMinutes: 0,
        windows: [],
      });
    }

    const target = grouped.get(key);
    target.availableMinutes += window.durationMinutes;
    target.windows.push({
      from: window.from,
      to: window.to,
      durationHours: window.durationHours,
      type: window.type,
    });
  }

  return [...grouped.values()]
    .sort((a, b) => getPlacementGroupOrder(a) - getPlacementGroupOrder(b))
    .map(group => ({
      ...group,
      availableHours: Number((group.availableMinutes / 60).toFixed(1)),
    }));
}

function parseJsonObjectLoose(content) {
  const raw = String(content || '').trim();
  if (!raw) return null;

  const candidates = [raw];
  const fenced = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
  if (fenced !== raw) candidates.push(fenced);

  const objectStart = raw.indexOf('{');
  const objectEnd = raw.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(raw.slice(objectStart, objectEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_) {
      // Continue trying looser candidates.
    }
  }

  return null;
}

function buildPlacementFallbackPlan(branch, slotSummary, studentData = {}) {
  const profile = PLACEMENT_BRANCH_PROFILES[branch] || PLACEMENT_BRANCH_PROFILES.CSE;
  const weeklyHours = Number((slotSummary.reduce((sum, slot) => sum + slot.availableMinutes, 0) / 60).toFixed(1));
  const courses = [...new Set((studentData?.timetable || []).map(item => item.subject).filter(Boolean))].slice(0, 5);

  return {
    headline: `${branch} placement plan built around your current timetable`,
    summary: `This fallback plan uses ${weeklyHours || 0} weekly prep hours from your scraped timetable and prioritizes ${profile.label} interview preparation with campus placement consistency.`,
    targetRoles: profile.targetRoles,
    coreSkills: profile.skills,
    projects: [
      `Build one ${branch} portfolio project and publish a concise write-up`,
      'Maintain a notes sheet for aptitude, HR stories, and technical revision',
      'Revise one core subject every week alongside problem solving',
    ],
    certifications: [
      'One fundamentals certification aligned to your branch',
      'One resume-ready project demo or report',
    ],
    roadmap: [
      {
        phase: 'Phase 1',
        title: 'Core revision and aptitude baseline',
        weeks: 'Weeks 1-3',
        focus: 'Strengthen branch fundamentals, aptitude speed, and resume basics.',
        deliverables: [
          'Finish one-page revision notes for core subjects',
          'Solve aptitude sets three times a week',
          'Create or refresh resume and LinkedIn headline',
        ],
      },
      {
        phase: 'Phase 2',
        title: 'Interview depth and project proof',
        weeks: 'Weeks 4-7',
        focus: 'Turn your branch knowledge into interview answers and portfolio proof.',
        deliverables: [
          'Ship one project milestone or lab-style mini build',
          'Prepare 20 frequently asked technical interview questions',
          'Practice one mock interview every week',
        ],
      },
      {
        phase: 'Phase 3',
        title: 'Placement sprint',
        weeks: 'Weeks 8-12',
        focus: 'Train for company rounds, timed problem solving, and HR narration.',
        deliverables: [
          'Complete two full mock rounds',
          'Prepare company-specific notes for at least five recruiters',
          'Track mistakes and revise weak topics twice weekly',
        ],
      },
    ],
    slotPlan: slotSummary.map((slot, index) => ({
      dayOrder: slot.dayOrder || slot.day,
      day: slot.day,
      focus: profile.skills[index % profile.skills.length],
      timeBlocks: slot.windows.map(window => `${window.from} - ${window.to}`),
      tasks: [
        `Use this block for ${profile.skills[index % profile.skills.length]}`,
        'Close with a 10-minute recap note and next-step checklist',
      ],
      weeklyHours: slot.availableHours,
    })),
    interviewPrep: [
      'Prepare concise self-introduction and project walkthroughs',
      'Keep a running sheet of repeated mistakes from quizzes and mocks',
      ...(courses.length ? [`Revise course-linked talking points for ${courses.join(', ')}`] : []),
    ],
  };
}

async function fetchRealUserInfo(authCookie) {
  const url = getCourseDynamicUrl();
  const rawData = await fetchRawAcademicPage(authCookie, url);
  if (rawData?.error) {
    throw new Error(rawData.error);
  }

  const parsed = parseSrmUserInfo(rawData);
  if (parsed.error) {
    throw new Error(parsed.error);
  }

  return parsed.userInfo || {};
}

function scoreAnswer(answer) {
  const text = (answer || '').trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const lower = text.toLowerCase();
  let score = 38;

  if (words >= 25) score += 14;
  if (words >= 60) score += 10;
  if (words >= 100) score += 6;
  if (/\b(example|because|result|impact|improved|built|designed|implemented)\b/.test(lower)) score += 12;
  if (/\b(i|my|me)\b/.test(lower)) score += 5;
  if (/\bteam|users|system|performance|scale|challenge|learned|deadline\b/.test(lower)) score += 8;
  if (/\bumm|uh|idk|don't know|not sure\b/.test(lower)) score -= 12;
  if (words < 12) score -= 18;

  return Math.max(18, Math.min(95, score));
}

function buildFallbackInterviewStart({ mode, companyName }) {
  const config = getInterviewConfig(mode);
  const firstQuestion = config.questions[0];

  return {
    intro: `${config.label} interview started. ${config.opening}${companyName ? ` Company focus: ${companyName}.` : ''}`,
    question: firstQuestion,
    questionIndex: 0,
  };
}

function buildFallbackInterviewTurn({ mode, answer, questionIndex }) {
  const config = getInterviewConfig(mode);
  const score = scoreAnswer(answer);
  const communication = Math.max(20, Math.min(98, score + (/[,.;:]/.test(answer) ? 4 : -3)));
  const technicalDepth = Math.max(20, Math.min(98, score + (/\b(system|api|database|complexity|tradeoff|architecture|scalable)\b/i.test(answer) ? 6 : -4)));
  const confidence = Math.max(20, Math.min(98, score + (/\bI\b/.test(answer) ? 4 : -5)));
  const strengths = [];
  const gaps = [];

  if (answer.length > 180) strengths.push('You gave enough context instead of a one-line answer.');
  if (/\bexample|project|built|implemented|result|impact\b/i.test(answer)) strengths.push('You used concrete examples instead of generic claims.');
  if (/\bteam|user|customer|deadline|pressure\b/i.test(answer)) strengths.push('You connected the answer to real execution constraints.');
  if (strengths.length === 0) strengths.push('You stayed on topic and answered the question directly.');

  if (answer.length < 120) gaps.push('Add more depth with one specific example and one measurable result.');
  if (!/\bresult|impact|improved|reduced|increased|learned\b/i.test(answer)) gaps.push('Close with a result or takeaway so the answer feels complete.');
  if (!/\bbecause|therefore|so that|which meant\b/i.test(answer)) gaps.push('Explain your reasoning, not just the action you took.');
  if (gaps.length === 0) gaps.push('Make the answer tighter and more structured to sound more senior.');

  const nextIndex = questionIndex + 1;
  const shouldEnd = nextIndex >= config.questions.length || nextIndex >= 4;

  return {
    score,
    communication,
    technicalDepth,
    confidence,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 3),
    feedback: `Your answer was ${score >= 75 ? 'strong' : score >= 55 ? 'decent' : 'underpowered'}. Focus on a tighter story: context, action, result.`,
    idealAnswer: 'Lead with the situation, explain your decision clearly, then finish with measurable impact and what you learned.',
    followUpQuestion: shouldEnd ? 'Interview complete.' : config.questions[nextIndex],
    shouldEnd,
    questionIndex: nextIndex,
  };
}

function buildFallbackInterviewSummary({ mode, transcript }) {
  const scores = transcript.map((entry) => entry.score).filter((value) => typeof value === 'number');
  const averageScore = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  const config = getInterviewConfig(mode);

  return {
    mode: config.label,
    averageScore,
    strengths: [
      'Stayed aligned to the interview question',
      'Showed willingness to explain your reasoning',
      'Built enough material to improve across sessions',
    ],
    weaknesses: [
      'Needs sharper examples with measurable outcomes',
      'Needs stronger closing statements after each answer',
      `Should improve on ${config.focusAreas[0]} and ${config.focusAreas[1]}`,
    ],
    nextSteps: [
      'Practice 3 answers using the STAR structure',
      'Add one number, outcome, or user impact to every answer',
      'Do another mock round within 24 hours to reinforce improvements',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. LEETCODE API — Fetch daily challenge and user stats
// ═══════════════════════════════════════════════════════════════════════

app.get('/api/leetcode/daily', async (req, res) => {
  try {
    const query = `
      query questionOfToday {
        activeDailyCodingChallengeQuestion {
          date
          userStatus
          link
          question {
            acRate
            difficulty
            freqBar
            frontendQuestionId: questionFrontendId
            isFavor
            paidOnly: isPaidOnly
            status
            title
            titleSlug
            hasVideoSolution
            hasSolution
            topicTags {
              name
              id
              slug
            }
          }
        }
      }
    `;

    const response = await axios.post('https://leetcode.com/graphql', { query });
    const daily = response.data.data.activeDailyCodingChallengeQuestion;

    res.json({
      title: daily.question.title,
      difficulty: daily.question.difficulty,
      date: daily.date,
      url: `https://leetcode.com${daily.link}`,
      topicTags: daily.question.topicTags.map(t => t.name)
    });
  } catch (error) {
    console.error('Error fetching LeetCode daily:', error.message);
    res.status(500).json({ error: 'Failed to fetch LeetCode daily problem' });
  }
});

app.get('/api/leetcode/user/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const query = `
      query userProblemsSolved($username: String!) {
        allQuestionsCount {
          difficulty
          count
        }
        matchedUser(username: $username) {
          profile {
            ranking
          }
          submitStats {
            acSubmissionNum {
              difficulty
              count
              submissions
            }
          }
        }
      }
    `;

    const response = await axios.post('https://leetcode.com/graphql', {
      query,
      variables: { username }
    }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://leetcode.com/',
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10s timeout
    });

    if (response.data.errors) {
      console.error('LeetCode GraphQL Errors:', response.data.errors);
      return res.status(500).json({ error: 'LeetCode API error' });
    }

    if (!response.data || !response.data.data) {
      console.error('LeetCode API returned no data:', response.data);
      return res.status(500).json({ error: 'LeetCode API failed to return data' });
    }

    const { matchedUser: user, allQuestionsCount: allStats } = response.data.data;
    
    if (!user) {
      return res.status(404).json({ error: 'User not found on LeetCode' });
    }

    const userStats = user.submitStats?.acSubmissionNum;
    if (!userStats) {
      return res.status(404).json({ error: 'Stats not found for this user' });
    }

    const formattedStats = {};
    userStats.forEach(s => {
      formattedStats[s.difficulty] = s.count;
    });

    const totalCounts = {};
    if (allStats) {
      allStats.forEach(s => {
        totalCounts[s.difficulty] = s.count;
      });
    }

    res.json({
      username,
      ranking: user.profile?.ranking || 'N/A',
      stats: formattedStats,
      totalCounts: totalCounts
    });
  } catch (error) {
    console.error('Error fetching LeetCode user stats:', error.message);
    res.status(500).json({ error: `Failed to fetch stats: ${error.message}` });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// SRM LOGIN — Multi-step API login endpoints (from SRM-Academia-Scraper-API)
// ═══════════════════════════════════════════════════════════════════════

app.post('/api/login/user', async (req, res) => {
  let { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  username = username.includes('@') ? username : `${username}@srmist.edu.in`;

  try {
    const result = await srmVerifyUser(username);
    if (result.error) return res.status(500).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('User verification error:', e.message);
    res.status(500).json({ error: 'Failed to verify user: ' + e.message });
  }
});

app.post('/api/login/password', async (req, res) => {
  const { digest, identifier, password } = req.body;
  if (!digest || !identifier || !password) {
    return res.status(400).json({ error: 'Digest, identifier, and password are required' });
  }

  try {
    const result = await srmVerifyPassword(digest, identifier, password);
    if (result.error) return res.status(500).json({ error: result.error });

    if (!result.isAuthenticated && result.captcha?.required) {
      const captchaData = await srmGetCaptchaImage(result.captcha.digest);
      if (captchaData?.error) return res.status(500).json({ error: captchaData.error });
      return res.json({
        isAuthenticated: false,
        statusCode: result.statusCode,
        message: result.message,
        captcha: {
          required: true,
          digest: result.captcha.digest,
          image: captchaData?.image_bytes || null,
        },
      });
    }

    res.json(result);
  } catch (e) {
    console.error('Password verification error:', e.message);
    res.status(500).json({ error: 'Failed to verify password: ' + e.message });
  }
});

app.post('/api/login/captcha', async (req, res) => {
  const { cdigest, password, digest, identifier, captcha } = req.body;
  if (!cdigest || !password || !digest || !identifier || !captcha) {
    return res.status(400).json({ error: 'All captcha fields are required' });
  }

  try {
    const result = await srmVerifyWithCaptcha(identifier, digest, captcha, cdigest, password);
    if (result.error) return res.status(500).json({ error: result.error });
    res.json(result);
  } catch (e) {
    console.error('Captcha verification error:', e.message);
    res.status(500).json({ error: 'Failed to verify captcha: ' + e.message });
  }
});

// ── SSE for real-time login progress ───────────────────────────────────
const activeStreams = new Map();

app.get('/api/auth/login/status/:sessionId', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('data: {"step":"connected","message":"Connected to server..."}\n\n');
  activeStreams.set(req.params.sessionId, res);
  req.on('close', () => activeStreams.delete(req.params.sessionId));
});

function sendStatus(sessionId, step, message) {
  const stream = activeStreams.get(sessionId);
  if (stream) stream.write(`data: ${JSON.stringify({ step, message })}\n\n`);
  console.log(`[${step}] ${message}`);
}

// ═══════════════════════════════════════════════════════════════════════
// 1. LOGIN — Unified login endpoint (API-based, no Puppeteer)
// ═══════════════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { username, password, sessionId } = req.body;

  if (!username || !password) {
    return res.status(400).json({ detail: 'Missing credentials' });
  }

  try {
    // Step 1: Verify username
    sendStatus(sessionId, 'email', 'Verifying username...');
    const userResult = await srmVerifyUser(username);
    if (!userResult.identity || !userResult.digest) {
      throw new Error(userResult.message || 'Username verification failed. Check your NetID.');
    }

    // Step 2: Verify password
    sendStatus(sessionId, 'password', 'Verifying password...');
    const passResult = await srmVerifyPassword(userResult.digest, userResult.identity, password, userResult._session);

    if (!passResult.isAuthenticated) {
      if (passResult.captcha?.required) {
        // Captcha needed — return captcha data so frontend can handle it
        const captchaData = await srmGetCaptchaImage(passResult.captcha.digest);
        return res.status(200).json({
          requiresCaptcha: true,
          captchaImage: captchaData?.image_bytes || null,
          captchaDigest: passResult.captcha.digest,
          digest: userResult.digest,
          identifier: userResult.identity,
          message: passResult.message || 'Captcha required',
        });
      }
      throw new Error(passResult.message || 'Login failed. Check your credentials.');
    }

    const authCookie = passResult.cookies;
    sendStatus(sessionId, 'loggedin', 'Login successful!');

    // Step 3: Fetch academic data using the session cookies
    let timetable = [];
    let attendance = [];
    let marks = [];
    let regNumber = '';
    let batch = '';
    let studentName = 'SRM Student';
    let userInfo = {};

    try {
      sendStatus(sessionId, 'discover', 'Syncing your academic records...');

      try {
        userInfo = await fetchRealUserInfo(authCookie);
      } catch (userInfoError) {
        console.error('User info sync error during login:', userInfoError.message);
      }

      // Fetch attendance & marks
      const attHtml = await fetchAcademicPage(authCookie,
        'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance');
      console.log('[DEBUG] Attendance page length:', attHtml.length, '| First 200 chars:', attHtml.substring(0, 200));
      const attResult = parseAttendance(attHtml);
      attendance = attResult.attendance;
      regNumber = attResult.regNumber;
      marks = parseMarks(attHtml, attendance);
      sendStatus(sessionId, 'attendance', `Synced ${attendance.length} courses and ${marks.length} marks`);

      // Fetch timetable
      const ttHtml = await fetchTimetablePage(authCookie);
      if (ttHtml) {
        const ttResult = parseCourses(ttHtml);
        batch = ttResult.batch;
        timetable = buildTimetable(ttResult.courses, batch);
        if (ttResult.studentName && ttResult.studentName.length > 2) studentName = ttResult.studentName;

        userInfo = {
          ...ttResult,
          ...userInfo,
          name: userInfo.name || ttResult.studentName || studentName,
          program: userInfo.program || ttResult.program || '',
          department: userInfo.department || ttResult.department || '',
          section: userInfo.section || ttResult.section || '',
          semester: userInfo.semester || ttResult.semester || '',
          branch: userInfo.branch || ttResult.branch || deriveAcademicBranch(userInfo.program || ttResult.program, userInfo.department || ttResult.department),
        };
      }
      sendStatus(sessionId, 'timetable', `Synced timetable with ${timetable.length} classes`);
    } catch (dataErr) {
      console.error('Data sync error during login:', dataErr.message);
      sendStatus(sessionId, 'error', 'Data sync partially failed, but login succeeded.');
    }

    sendStatus(sessionId, 'done', 'All set!');

    // Fetch current day order
    const currentDayOrder = await fetchCurrentDayOrder(authCookie);

    // Criterion: Security Implementation (JWT Authentication)
    const jwtToken = jwt.sign(
      { 
        studentName, 
        regNumber, 
        branch: userInfo.branch,
        srmCookie: authCookie 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.json({
      token: jwtToken,
      message: `Welcome ${studentName}! Logged in successfully.`,
      data_source: 'live',
      student_data: {
        name: userInfo.name || studentName,
        regNumber,
        batch,
        branch: userInfo.branch || deriveAcademicBranch(userInfo.program, userInfo.department),
        program: userInfo.program || '',
        department: userInfo.department || '',
        section: userInfo.section || '',
        semester: userInfo.semester || '',
        timetable,
        attendance,
        marks,
        currentDayOrder,
        data_source: 'live',
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    sendStatus(sessionId, 'error', `Error: ${error.message}`);
    res.status(401).json({ detail: `Login failed: ${error.message}` });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 2. TIMETABLE — Fetch real timetable via verified JWT
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/timetable', verifyToken, async (req, res) => {
  const authCookie = req.user.srmCookie;

  try {
    const { timetable, regNumber, batch, studentName, program, department, section, semester, branch } = await fetchRealTimetable(authCookie);
    const currentDayOrder = await fetchCurrentDayOrder(authCookie);
    res.json({
      timetable,
      regNumber,
      batch,
      name: studentName,
      program,
      department,
      section,
      semester,
      branch,
      currentDayOrder,
      source: 'live'
    });
  } catch (e) {
    console.error('Timetable API error:', e.message);
    res.status(502).json({ error: 'Failed to fetch timetable from Academia', detail: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 3. ATTENDANCE — Fetch real attendance via verified JWT
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/attendance', verifyToken, async (req, res) => {
  const authCookie = req.user.srmCookie;

  try {
    const html = await fetchAcademicPage(authCookie,
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance');
    const result = parseAttendance(html);
    res.json({ attendance: result.attendance, regNumber: result.regNumber, source: 'live' });
  } catch (e) {
    console.error('Attendance API error:', e.message);
    res.status(502).json({ error: 'Failed to fetch attendance from Academia', detail: e.message });
  }
});

app.get('/api/marks', verifyToken, async (req, res) => {
  const authCookie = req.user.srmCookie;

  try {
    const html = await fetchAcademicPage(authCookie,
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance');
    const attResult = parseAttendance(html);
    const marks = parseMarks(html, attResult.attendance);
    res.json({ marks, source: 'live' });
  } catch (e) {
    console.error('Marks API error:', e.message);
    res.status(502).json({ error: 'Failed to fetch marks from Academia', detail: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 3.5. ACADEMICS — Combined attendance + marks in one call
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/academics', verifyToken, async (req, res) => {
  const authCookie = req.user.srmCookie;

  try {
    const html = await fetchAcademicPage(authCookie,
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance');
    const attResult = parseAttendance(html);
    const marks = parseMarks(html, attResult.attendance);

    res.json({
      attendance: attResult.attendance,
      marks,
      regNumber: attResult.regNumber,
      source: 'live'
    });
  } catch (e) {
    console.error('Academics API error:', e.message);
    res.status(502).json({ error: 'Failed to fetch academic data from Academia', detail: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 4. SYNC — Full re-sync using credentials (API-based, no Puppeteer)
// ═══════════════════════════════════════════════════════════════════════
app.post('/api/auth/sync', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Credentials needed for sync' });

  try {
    // Step 1: Login via API
    const userResult = await srmVerifyUser(username);
    if (!userResult.identity || !userResult.digest) {
      throw new Error(userResult.message || 'Username verification failed');
    }

    const passResult = await srmVerifyPassword(userResult.digest, userResult.identity, password, userResult._session);
    if (!passResult.isAuthenticated) {
      throw new Error(passResult.message || 'Password verification failed');
    }

    const authCookie = passResult.cookies;

    // Step 2: Fetch academic data
    let userInfo = {};
    try {
      userInfo = await fetchRealUserInfo(authCookie);
    } catch (userInfoError) {
      console.error('Sync user info error:', userInfoError.message);
    }

    const attHtml = await fetchAcademicPage(authCookie,
      'https://academia.srmist.edu.in/srm_university/academia-academic-services/page/My_Attendance');
    const attResult = parseAttendance(attHtml);
    const marks = parseMarks(attHtml, attResult.attendance);

    const ttHtml = await fetchTimetablePage(authCookie);
    const ttResult = ttHtml
      ? parseCourses(ttHtml)
      : {
          courses: [], batch: '1', studentName: '', regNumber: '',
          program: '', department: '', section: '', semester: '', branch: '',
        };

    userInfo = {
      ...ttResult,
      ...userInfo,
      name: userInfo.name || ttResult.studentName || '',
      program: userInfo.program || ttResult.program || '',
      department: userInfo.department || ttResult.department || '',
      section: userInfo.section || ttResult.section || '',
      semester: userInfo.semester || ttResult.semester || '',
      branch: userInfo.branch || ttResult.branch || deriveAcademicBranch(userInfo.program || ttResult.program, userInfo.department || ttResult.department),
    };

    const currentDayOrder = await fetchCurrentDayOrder(authCookie);

    res.json({
      token: authCookie,
      student_data: {
        timetable: buildTimetable(ttResult.courses, ttResult.batch),
        attendance: attResult.attendance,
        marks,
        regNumber: attResult.regNumber || ttResult.regNumber,
        batch: ttResult.batch,
        name: userInfo.name || ttResult.studentName,
        branch: userInfo.branch || ttResult.branch || deriveAcademicBranch(userInfo.program, userInfo.department),
        program: userInfo.program || '',
        department: userInfo.department || '',
        section: userInfo.section || '',
        semester: userInfo.semester || '',
        currentDayOrder,
      },
    });
  } catch (error) {
    console.error('Sync error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 5. COURSE — Course details via scraper-style parsing
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/course', async (req, res) => {
  const authCookie = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : (req.headers.token || null);
  if (!authCookie) return res.status(401).json({ error: 'Missing authorization token' });

  try {
    const url = getCourseDynamicUrl();
    const rawData = await fetchRawAcademicPage(authCookie, url);
    if (rawData?.error) return res.status(rawData.status || 401).json({ error: rawData.error });
    const parsed = parseSrmCourseDetails(rawData);
    if (parsed.error) return res.status(parsed.status || 500).json({ error: parsed.error });
    res.json(parsed);
  } catch (e) {
    console.error('Course API error:', e.message);
    res.status(502).json({ error: 'Failed to fetch course details', detail: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 6. CALENDAR — Academic calendar via scraper-style parsing
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/calendar', async (req, res) => {
  const authCookie = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : (req.headers.token || null);
  if (!authCookie) return res.status(401).json({ error: 'Missing authorization token' });

  try {
    const url = getCalendarDynamicUrl();
    const rawData = await fetchRawAcademicPage(authCookie, url);
    if (rawData?.error) return res.status(rawData.status || 401).json({ error: rawData.error });
    const parsed = parseSrmCalendar(rawData);
    if (parsed.error) return res.status(parsed.status || 500).json({ error: parsed.error });
    res.json(parsed);
  } catch (e) {
    console.error('Calendar API error:', e.message);
    res.status(502).json({ error: 'Failed to fetch calendar', detail: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 7. USER INFO — Student profile info via scraper-style parsing
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/userinfo', async (req, res) => {
  const authCookie = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : (req.headers.token || null);
  if (!authCookie) return res.status(401).json({ error: 'Missing authorization token' });

  try {
    const url = getCourseDynamicUrl();
    const rawData = await fetchRawAcademicPage(authCookie, url);
    if (rawData?.error) return res.status(rawData.status || 401).json({ error: rawData.error });
    const parsed = parseSrmUserInfo(rawData);
    if (parsed.error) return res.status(parsed.status || 500).json({ error: parsed.error });
    res.json(parsed);
  } catch (e) {
    console.error('UserInfo API error:', e.message);
    res.status(502).json({ error: 'Failed to fetch user info', detail: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 8. LOGOUT — Clear SRM session
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/logout', async (req, res) => {
  const authCookie = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : (req.headers.token || null);
  if (!authCookie) return res.status(400).json({ error: 'Token is required' });

  try {
    await axios({
      method: 'GET',
      url: 'https://academia.srmist.edu.in/accounts/p/10002227248/logout?servicename=ZohoCreator&serviceurl=https://academia.srmist.edu.in',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded',
        'cookie': authCookie,
      },
    });
    res.json({ message: 'Logged out successfully' });
  } catch (_) {
    res.json({ message: 'Logged out successfully' });
  }
});



// ═══════════════════════════════════════════════════════════════════════
// 3. CHATBOT — Open Source LLM API
// ═══════════════════════════════════════════════════════════════════════
app.post('/api/chatbot/ask', async (req, res) => {
  const { message, student_data, history } = req.body;

  const LLM_API_KEY = process.env.LLM_API_KEY;
  const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.mistral.ai/v1';
  const LLM_MODEL = process.env.LLM_MODEL || 'mistral-tiny';

  if (!LLM_API_KEY) {
    return res.status(500).json({ reply: 'LLM API key not configured. Set LLM_API_KEY in your environment.' });
  }

  try {
    const systemPrompt = `You are LockedIn AI, a comprehensive academic and placement assistant. 
You are speaking to an engineering student. You have access to their real-time data:
1. **Timetable & Classes**: Know their daily schedule and where they should be.
2. **Activities & Reminders**: Track their pending tasks, study goals, and health habits.
3. **LeetCode Stats**: Know their coding progress (Easy/Medium/Hard solved) and current username.
4. **Mock Interviews & Quizzes**: Aware of their recent performance and areas for improvement.

Current Time: ${student_data?.currentTime || 'N/A'}
Current Day: ${student_data?.currentDay || 'N/A'}

Student Context: ${JSON.stringify(student_data || {})} 

Be their mentor. If they have a class soon, remind them. If their LeetCode stats are low, encourage them to solve the Daily Challenge. Be proactive and helpful.`;

    // Standard OpenAI compatible messages array
    const messages = [{ role: "system", content: systemPrompt }];

    // Add history
    if (history && history.length > 0) {
      for (const entry of history) {
        messages.push({ role: entry.role, content: entry.text });
      }
    }

    // Add the current message if not already in history
    if (!history || history.length === 0) {
      messages.push({ role: 'user', content: message });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to start stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep partial line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // Ignore parse errors for incomplete JSON
          }
        }
      }
    }
    res.end();
  } catch (error) {
    console.error('Chatbot streaming error:', error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 4. AI MOCK INTERVIEWER
// ═══════════════════════════════════════════════════════════════════════
app.post('/api/interview/start', async (req, res) => {
  const { mode = 'hr', companyName = '', student_data: studentData } = req.body || {};
  const config = getInterviewConfig(mode);

  try {
    const content = await runChatCompletion(
      [
        {
          role: 'system',
          content: createInterviewPrompt({
            stage: 'start',
            mode,
            companyName,
            studentData,
            history: [],
            questionIndex: 0,
          }),
        },
      ],
      { temperature: 0.5, max_tokens: 120 }
    );

    return res.json({
      mode,
      intro: `${config.label} interview started. ${config.opening}${companyName ? ` Company focus: ${companyName}.` : ''}`,
      question: content || config.questions[0],
      questionIndex: 0,
      provider: 'llm',
    });
  } catch (error) {
    console.error('Interview start fallback:', error.message);
    return res.json({
      mode,
      ...buildFallbackInterviewStart({ mode, companyName }),
      provider: 'local',
    });
  }
});

app.post('/api/interview/respond', async (req, res) => {
  const {
    mode = 'hr',
    companyName = '',
    questionIndex = 0,
    answer = '',
    history = [],
    student_data: studentData,
  } = req.body || {};

  try {
    const content = await runChatCompletion(
      [
        {
          role: 'system',
          content: createInterviewPrompt({
            stage: 'respond',
            mode,
            companyName,
            studentData,
            history,
            answer,
            questionIndex,
          }),
        },
      ],
      {
        temperature: 0.4,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }
    );

    const parsed = JSON.parse(content);
    return res.json({
      ...parsed,
      questionIndex: questionIndex + 1,
      provider: 'llm',
    });
  } catch (error) {
    console.error('Interview response fallback:', error.message);
    return res.json({
      ...buildFallbackInterviewTurn({ mode, answer, questionIndex }),
      provider: 'local',
    });
  }
});

app.post('/api/interview/summary', async (req, res) => {
  const { mode = 'hr', transcript = [], student_data: studentData } = req.body || {};

  try {
    const content = await runChatCompletion(
      [
        {
          role: 'system',
          content: `You are an interview coach. Analyze this mock interview transcript and return strict JSON:
{
  "mode": "string",
  "averageScore": number,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "nextSteps": ["..."]
}

Interview mode: ${mode}
Student data: ${JSON.stringify(studentData || {})}
Transcript: ${JSON.stringify(transcript)}

Keep each list to 3 items max and make it practical.`,
        },
      ],
      {
        temperature: 0.3,
        max_tokens: 350,
        response_format: { type: 'json_object' },
      }
    );

    return res.json({
      ...JSON.parse(content),
      provider: 'llm',
    });
  } catch (error) {
    console.error('Interview summary fallback:', error.message);
    return res.json({
      ...buildFallbackInterviewSummary({ mode, transcript }),
      provider: 'local',
    });
  }
});

app.post('/api/interview/generate-resume-questions', async (req, res) => {
  const { resumeText } = req.body;
  if (!resumeText) return res.status(400).json({ error: 'No resume provided' });

  try {
    const prompt = `You are an expert technical interviewer. Based on the following Candidate Resume/Project Context, generate 5 challenging and specific interview questions you would ask this candidate.
Return ONLY valid JSON in this format:
{
  "questions": [
    "question 1",
    "question 2",
    "question 3",
    "question 4",
    "question 5"
  ]
}

Resume/Project Context:
${resumeText}
`;

    const content = await runChatCompletion([
      { role: 'user', content: prompt }
    ], { temperature: 0.6, max_tokens: 300, response_format: { type: 'json_object' } });

    const parsed = JSON.parse(content);
    return res.json(parsed);
  } catch (error) {
    console.error('Error generating resume questions:', error.message);
    return res.status(500).json({ error: 'Failed to generate questions.' });
  }
});

app.post('/api/quiz/generate', async (req, res) => {
  const { category = 'Data Structures', difficulty = 'Medium', topics = '' } = req.body;

  try {
    const normalizedTopics = String(topics || '').trim();
    const topicConstraint = normalizedTopics
      ? `The student requested these specific sub-topics: "${normalizedTopics}". Ensure all questions stay within these sub-topics.`
      : 'If no specific sub-topics are provided, keep the quiz broad within the chosen category.';

    const prompt = `You are a placement preparation expert. Generate a focused quiz on the topic "${category}" with a difficulty level of "${difficulty}".
${topicConstraint}
Return a JSON object with this exact shape:
{
  "id": number,
  "category": "string",
  "title": "string",
  "difficulty": "Easy" | "Medium" | "Hard",
  "questions": [
    {
      "question": "string",
      "options": ["option 0", "option 1", "option 2", "option 3"],
      "correct": number (index 0-3)
    }
  ]
}
Generate exactly 5 questions. Make sure the content is technical, accurate, and suitable for high-level engineering placements. Use different questions every time.`;

    const content = await runChatCompletion([
      { role: 'user', content: prompt }
    ], { temperature: 0.8, max_tokens: 1000, response_format: { type: 'json_object' } });

    const parsed = JSON.parse(content);
    res.json(parsed);
  } catch (error) {
    console.error('Quiz Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate dynamic quiz' });
  }
});

app.post('/api/roadmap/generate', async (req, res) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'No role provided' });

  const LLM_API_KEY = process.env.LLM_API_KEY;
  const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.mistral.ai/v1';
  const LLM_MODEL = process.env.LLM_MODEL || 'mistral-tiny';

  if (!LLM_API_KEY) {
    return res.status(500).json({ error: 'LLM API key not configured.' });
  }

  try {
    const messages = [
      {
        role: 'system',
        content: `You are a world-class career growth expert and technical recruiter. 
Your task is to generate a comprehensive, phased roadmap for a student.
CRITICAL: You MUST return ONLY a valid raw JSON array of objects. 
Each object MUST have: id (number), title (string), desc (string), duration (string), status (string: "pending").
Provide 6-7 logical phases.
NO introductory text. NO markdown formatting. NO backticks. NO \`\`\`json blocks. 
ONLY the JSON array starting with [ and ending with ].`
      },
      {
        role: 'user',
        content: `Generate a career roadmap for the role: "${role}"`
      }
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: 0.2, // Extremely low for stability
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mistral error details:', errorText);
      throw new Error(`Mistral API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep partial line in buffer

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine || cleanLine === 'data: [DONE]') {
          if (cleanLine === 'data: [DONE]') {
            res.write('data: [DONE]\n\n');
          }
          continue;
        }

        if (cleanLine.startsWith('data: ')) {
          try {
            const jsonStr = cleanLine.slice(6);
            const data = JSON.parse(jsonStr);
            const content = data.choices?.[0]?.delta?.content || '';
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // Silently ignore incomplete JSON chunks - common in streaming
          }
        }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Roadmap Streaming Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.post('/api/placement-plan/generate', async (req, res) => {
  const { branch, student_data, stream } = req.body || {};
  const finalBranch = inferPlacementBranch(student_data || {}, branch);
  const timetable = Array.isArray(student_data?.timetable) ? student_data.timetable : [];
  const freeWindows = analyzePlacementSchedule(timetable);
  const slotSummary = summarizePlacementWindows(freeWindows);
  const weeklyHours = Number((slotSummary.reduce((sum, slot) => sum + slot.availableHours, 0)).toFixed(1));
  const branchProfile = PLACEMENT_BRANCH_PROFILES[finalBranch] || PLACEMENT_BRANCH_PROFILES.CSE;

  const fallbackPlan = buildPlacementFallbackPlan(finalBranch, slotSummary, student_data || {});
  const streamMode = Boolean(stream);
  const sendSse = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const LLM_API_KEY = process.env.LLM_API_KEY;
  if (!LLM_API_KEY && !streamMode) {
    return res.json({
      branch: finalBranch,
      source: 'fallback',
      slotSummary,
      freeWindows,
      plan: fallbackPlan,
    });
  }

  const courseList = [...new Set(timetable.map(item => item.subject).filter(Boolean))].slice(0, 8);

  const messages = [
    {
      role: 'system',
      content: `You are LockedIn Placement Planner, an expert campus placement mentor.
Return only valid raw JSON as a single object.
Do not wrap the JSON in markdown.
Build a branch-specific placement plan that uses the provided free windows from the student's scraped timetable.
Never invent extra day orders or extra time blocks.
Prefer concise, practical phrasing.

Return this exact shape:
{
  "headline": "string",
  "summary": "string",
  "targetRoles": ["string"],
  "coreSkills": ["string"],
  "projects": ["string"],
  "certifications": ["string"],
  "roadmap": [
    {
      "phase": "string",
      "title": "string",
      "weeks": "string",
      "focus": "string",
      "deliverables": ["string"]
    }
  ],
  "slotPlan": [
    {
      "dayOrder": "string",
      "day": "string",
      "focus": "string",
      "timeBlocks": ["HH:MM AM - HH:MM PM"],
      "tasks": ["string"],
      "weeklyHours": number
    }
  ],
  "interviewPrep": ["string"]
}

Constraints:
- Roadmap must contain exactly 3 phases.
- Slot plan should cover each provided slot summary item once.
- Each slot plan item must stay aligned to the same dayOrder/day and available time blocks.
- Focus heavily on ${branchProfile.label} placements while keeping aptitude, resume, and HR prep in scope.`
    },
    {
      role: 'user',
      content: JSON.stringify({
        selectedBranch: finalBranch,
        branchProfile,
        weeklyHours,
        currentDayOrder: student_data?.currentDayOrder || null,
        program: student_data?.program || '',
        department: student_data?.department || '',
        courses: courseList,
        slotSummary,
      }),
    },
  ];

  if (streamMode) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    sendSse({
      type: 'meta',
      branch: finalBranch,
      slotSummary,
      freeWindows,
      source: 'stream',
    });

    if (!LLM_API_KEY) {
      sendSse({
        type: 'done',
        payload: {
          branch: finalBranch,
          source: 'fallback',
          slotSummary,
          freeWindows,
          plan: fallbackPlan,
        },
      });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    try {
      const response = await fetch(`${process.env.LLM_BASE_URL || 'https://api.mistral.ai/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL || 'mistral-tiny',
          messages,
          temperature: 0.35,
          max_tokens: 1800,
          response_format: { type: 'json_object' },
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral stream error ${response.status}: ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine || cleanLine === 'data: [DONE]') continue;

          if (cleanLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(cleanLine.slice(6));
              const content = data.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                sendSse({ type: 'content', content });
              }
            } catch (_) {
              // Ignore partial stream chunks.
            }
          }
        }
      }

      const parsed = parseJsonObjectLoose(fullContent);
      const mergedPlan = parsed ? {
        ...fallbackPlan,
        ...parsed,
        roadmap: Array.isArray(parsed.roadmap) && parsed.roadmap.length ? parsed.roadmap : fallbackPlan.roadmap,
        slotPlan: Array.isArray(parsed.slotPlan) && parsed.slotPlan.length ? parsed.slotPlan : fallbackPlan.slotPlan,
        targetRoles: Array.isArray(parsed.targetRoles) && parsed.targetRoles.length ? parsed.targetRoles : fallbackPlan.targetRoles,
        coreSkills: Array.isArray(parsed.coreSkills) && parsed.coreSkills.length ? parsed.coreSkills : fallbackPlan.coreSkills,
        projects: Array.isArray(parsed.projects) && parsed.projects.length ? parsed.projects : fallbackPlan.projects,
        certifications: Array.isArray(parsed.certifications) && parsed.certifications.length ? parsed.certifications : fallbackPlan.certifications,
        interviewPrep: Array.isArray(parsed.interviewPrep) && parsed.interviewPrep.length ? parsed.interviewPrep : fallbackPlan.interviewPrep,
      } : fallbackPlan;

      sendSse({
        type: 'done',
        payload: {
          branch: finalBranch,
          source: parsed ? 'mistral' : 'fallback',
          slotSummary,
          freeWindows,
          plan: mergedPlan,
        },
      });
      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (error) {
      console.error('Placement plan streaming error:', error.message);
      sendSse({ type: 'error', error: error.message });
      sendSse({
        type: 'done',
        payload: {
          branch: finalBranch,
          source: 'fallback',
          slotSummary,
          freeWindows,
          plan: fallbackPlan,
        },
      });
      res.write('data: [DONE]\n\n');
      return res.end();
    }
  }

  try {
    const content = await runChatCompletion(messages, {
      temperature: 0.35,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    });

    const parsed = parseJsonObjectLoose(content);
    if (!parsed) {
      throw new Error('Invalid JSON returned from LLM');
    }

    res.json({
      branch: finalBranch,
      source: 'mistral',
      slotSummary,
      freeWindows,
      plan: {
        ...fallbackPlan,
        ...parsed,
        roadmap: Array.isArray(parsed.roadmap) && parsed.roadmap.length ? parsed.roadmap : fallbackPlan.roadmap,
        slotPlan: Array.isArray(parsed.slotPlan) && parsed.slotPlan.length ? parsed.slotPlan : fallbackPlan.slotPlan,
        targetRoles: Array.isArray(parsed.targetRoles) && parsed.targetRoles.length ? parsed.targetRoles : fallbackPlan.targetRoles,
        coreSkills: Array.isArray(parsed.coreSkills) && parsed.coreSkills.length ? parsed.coreSkills : fallbackPlan.coreSkills,
        projects: Array.isArray(parsed.projects) && parsed.projects.length ? parsed.projects : fallbackPlan.projects,
        certifications: Array.isArray(parsed.certifications) && parsed.certifications.length ? parsed.certifications : fallbackPlan.certifications,
        interviewPrep: Array.isArray(parsed.interviewPrep) && parsed.interviewPrep.length ? parsed.interviewPrep : fallbackPlan.interviewPrep,
      },
    });
  } catch (error) {
    console.error('Placement plan generation error:', error.message);
    res.json({
      branch: finalBranch,
      source: 'fallback',
      slotSummary,
      freeWindows,
      plan: fallbackPlan,
    });
  }
});

app.post('/api/interview/upload-resume', verifyToken, upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    const fileBuffer = req.file.buffer;
    const fileName = `resumes/${Date.now()}-${req.file.originalname}`;

    // Criterion: Cloud & Hyperscaler Usage (AWS S3 Integration)
    if (isS3Enabled) {
      console.log(`[Cloud] Uploading ${fileName} to AWS S3...`);
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: fileBuffer,
        ContentType: req.file.mimetype,
      });
      await s3Client.send(command);
    } else {
      console.log(`[Local] S3 not configured, processing file from memory.`);
    }

    const data = await pdf(fileBuffer);
    res.json({ 
      text: data.text, 
      storage: isS3Enabled ? 's3' : 'local',
      path: isS3Enabled ? fileName : 'memory'
    });
  } catch (error) {
    console.error('Resume Processing Error:', error);
    res.status(500).json({ error: 'Failed to process resume' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Trending News API
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/news/trending', async (req, res) => {
  try {
    const q = 'technology OR "job market" OR hiring OR software';
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q,
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 15,
        apiKey: process.env.NEWS_API_KEY || '10e42da5ba1c47d3a88a9fc077a76403'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching news:', error.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// AI Readiness ML Model API
// ═══════════════════════════════════════════════════════════════════════
app.post('/api/ml/predict-readiness', verifyToken, (req, res) => {
  const { attendance, lc_easy, lc_medium, lc_hard, study_hours } = req.body;
  
  if (attendance === undefined) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const pythonProcess = spawn('python', [
    'ml/predict.py',
    attendance || 0,
    lc_easy || 0,
    lc_medium || 0,
    lc_hard || 0,
    study_hours || 15
  ]);

  let result = '';

  pythonProcess.stdout.on('data', (data) => {
    result += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`ML script stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Failed to generate ML prediction' });
    }
    try {
      const parsed = JSON.parse(result);
      if (parsed.status === 'failed') {
        return res.status(500).json(parsed);
      }
      res.json(parsed);
    } catch (e) {
      console.error('Failed to parse ML script output:', result);
      res.status(500).json({ error: 'Invalid prediction output' });
    }
  });
});

app.post('/api/ml/sentiment', verifyToken, (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Missing text parameter' });
  }

  const pythonProcess = spawn('python', ['ml/analyze_sentiment.py', text]);
  let result = '';

  pythonProcess.stdout.on('data', (data) => {
    result += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Sentiment script stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Failed to generate sentiment prediction' });
    }
    try {
      const parsed = JSON.parse(result);
      if (parsed.status === 'failed') return res.status(500).json(parsed);
      res.json(parsed);
    } catch (e) {
      console.error('Failed to parse sentiment script output:', result);
      res.status(500).json({ error: 'Invalid prediction output' });
    }
  });
});

app.post('/api/ml/resume-match', verifyToken, (req, res) => {
  const { resume_text, jd_text } = req.body;
  
  if (!resume_text || !jd_text) {
    return res.status(400).json({ error: 'Missing resume_text or jd_text parameter' });
  }

  const pythonProcess = spawn('python', ['ml/resume_matcher.py', resume_text, jd_text]);
  let result = '';

  pythonProcess.stdout.on('data', (data) => {
    result += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Resume Match script stderr: ${data}`);
  });

  pythonProcess.on('close', async (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Failed to generate resume match' });
    }
    try {
      const parsed = JSON.parse(result);
      if (parsed.status === 'failed') return res.status(500).json(parsed);

      // Criterion: ML/AI Workflow (Advanced LLM Feedback)
      const LLM_API_KEY = process.env.LLM_API_KEY;
      if (LLM_API_KEY && parsed.match_score < 90) {
        try {
          const feedbackPrompt = `
            Job Description: ${jd_text.substring(0, 1000)}
            Resume Match Score: ${parsed.match_score}%
            Missing Keywords: ${parsed.missing_keywords.join(', ')}
            
            Based on the above, provide 3 brief, actionable bullet points for the student to improve their resume for this specific role. 
            Keep it under 60 words total.
          `;
          
          const llmResponse = await axios.post(`${process.env.LLM_BASE_URL || 'https://api.mistral.ai/v1'}/chat/completions`, {
            model: process.env.LLM_MODEL || 'mistral-tiny',
            messages: [{ role: 'user', content: feedbackPrompt }],
            max_tokens: 150
          }, {
            headers: { 'Authorization': `Bearer ${LLM_API_KEY}` }
          });
          
          parsed.ai_feedback = llmResponse.data.choices[0].message.content;
        } catch (llmErr) {
          console.error('LLM Feedback Error:', llmErr.message);
        }
      }

      res.json(parsed);
    } catch (e) {
      console.error('Failed to parse resume match script output:', result);
      res.status(500).json({ error: 'Invalid output' });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Health check
// ═══════════════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
