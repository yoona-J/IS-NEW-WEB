const express = require('express');
const router = express.Router();
const https = require('https');

const BASE_URL = 'https://m.hanyang.ac.kr';
const PAGE_URL = `${BASE_URL}/v3/hy_curriculum.page`;
const API_URL = `${BASE_URL}/commonAjaxCall.json`;

function requestGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers,
      timeout: 10000,
    }, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    req.on('error', reject);

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

function parseCookie(setCookie = []) {
  return setCookie
    .map(cookie => cookie.split(';')[0])
    .join('; ');
}

async function getCookieHeader(lang_gb = 'ko') {
  const pageUrl = new URL(PAGE_URL);
  pageUrl.searchParams.set('lang_gb', lang_gb);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  const { status, headers: responseHeaders } = await requestGet(pageUrl.toString(), headers);

  if (status < 200 || status >= 300) {
    throw new Error(`Failed to fetch page cookie. Status: ${status}`);
  }

  return parseCookie(responseHeaders['set-cookie']);
}

async function fetchJson(url, cookieHeader) {
  const headers = {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://m.hanyang.ac.kr/v3/hy_curriculum.page?lang_gb=ko',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const { status, body } = await requestGet(url, headers);

  try {
    return {
      status,
      body: JSON.parse(body),
    };
  } catch {
    return {
      status,
      body,
    };
  }
}

router.get('/', async (req, res) => {
  const {
    apiUrl = '/HYRC/A202200006.json',
    gygj_cd,
    slg_sosok_cd = 'H0002867',
    lang_gb = 'ko',
  } = req.query;

  try {
    const cookieHeader = await getCookieHeader(lang_gb);

    const url = new URL(API_URL);
    url.searchParams.set('apiUrl', apiUrl);

    if (gygj_cd) {
      url.searchParams.set('gygj_cd', gygj_cd);
    }

    url.searchParams.set('slg_sosok_cd', slg_sosok_cd);
    url.searchParams.set('lang_gb', lang_gb);

    const { status, body } = await fetchJson(url.toString(), cookieHeader);

    if (status !== 200) {
      return res.status(status).json({
        error: 'Failed to fetch curriculum data',
        status,
        body,
      });
    }

    res.json(body);
  } catch (err) {
    console.error('Curriculum fetch error:', err.message);

    res.status(500).json({
      error: 'Failed to fetch curriculum data',
      message: err.message,
    });
  }
});

module.exports = router;
