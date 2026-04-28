const axios = require('axios');
const cheerio = require('cheerio');
const { readCache, writeCache } = require('./cache');

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function normalizeWebsiteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeEmail(value) {
  return String(value || '').trim().replace(/[.,;:]+$/g, '').toLowerCase();
}

function extractEmailsFromText(text) {
  return Array.from(new Set((String(text || '').match(EMAIL_REGEX) || []).map(normalizeEmail)));
}

function extractEmailsFromHtml(html) {
  if (!html) return [];

  const $ = cheerio.load(html);
  const emails = new Set();

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const value = href.replace(/^mailto:/i, '').split('?')[0];
    const email = normalizeEmail(value);
    if (email) emails.add(email);
  });

  const textCandidates = [
    $('body').text(),
    $('html').text(),
    html,
  ];

  for (const candidate of textCandidates) {
    for (const email of extractEmailsFromText(candidate)) {
      emails.add(email);
    }
  }

  return [...emails];
}

async function fetchEmailCandidatesFromWebsite(website) {
  const normalizedWebsite = normalizeWebsiteUrl(website);
  if (!normalizedWebsite) return [];

  const cachePayload = { website: normalizedWebsite };
  const cached = await readCache('website_emails', cachePayload);
  if (cached) return cached;

  try {
    const { data } = await axios.get(normalizedWebsite, {
      timeout: Number(process.env.EMAIL_ENRICHMENT_TIMEOUT_MS || 12000),
      maxRedirects: 3,
      headers: {
        'User-Agent': 'x3com-prospection-fibre/1.0 (public-email-enrichment)',
        'Accept-Language': 'fr',
      },
    });

    const results = extractEmailsFromHtml(data);
    await writeCache('website_emails', cachePayload, results);
    return results;
  } catch (error) {
    await writeCache('website_emails', cachePayload, []);
    return [];
  }
}

async function enrichLeadEmail(lead) {
  if (lead.email) return lead;
  if (!lead.website) return lead;

  const emails = await fetchEmailCandidatesFromWebsite(lead.website);
  if (emails.length > 0) {
    return {
      ...lead,
      email: emails[0],
    };
  }

  return lead;
}

module.exports = {
  enrichLeadEmail,
  fetchEmailCandidatesFromWebsite,
  extractEmailsFromHtml,
  normalizeWebsiteUrl,
};