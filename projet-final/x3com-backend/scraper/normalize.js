function normalizeString(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function classifyTargetSegment(lead) {
  const haystack = normalizeString([
    lead.category,
    lead.searchQuery,
    lead.name,
    lead.address,
  ].filter(Boolean).join(' '));

  if (/syndic|copropriete|gestion immobiliere/.test(haystack)) return 'b2b_syndic';
  if (/particulier|maison|villa|residence/.test(haystack)) return 'particulier';
  return 'b2b_entreprise';
}

function pickCityFromAddress(address) {
  const raw = String(address || '');
  const zipMatch = raw.match(/\b(\d{5})\b\s+([^,]+)/);
  if (!zipMatch) return { postalCode: null, city: null };
  return {
    postalCode: zipMatch[1] || null,
    city: (zipMatch[2] || '').trim() || null,
  };
}

function buildDedupeKey(lead) {
  const name = normalizeString(lead.name);
  const phone = normalizePhone(lead.phone);
  const city = normalizeString(lead.city);
  const address = normalizeString(lead.address);

  if (phone) return `${name}|${phone}`;
  if (address) return `${name}|${address}`;
  return `${name}|${city}`;
}

function computeFiberScore(lead) {
  const haystack = normalizeString([
    lead.category,
    lead.searchQuery,
    lead.name,
    lead.address,
  ].filter(Boolean).join(' '));

  const rules = [
    { re: /fibre|ftth|telecom|telecoms/, points: 60, reason: 'Activite telecommunication/fibre' },
    { re: /terrassement|travaux publics|vrd|genie civil/, points: 35, reason: 'Travaux de voirie/terrassement' },
    { re: /electricien|reseau|cablage/, points: 20, reason: 'Metier technique reseau' },
    { re: /syndic|copropriete|gestion immobiliere/, points: 15, reason: 'Decideur d immeuble' },
  ];

  let score = 0;
  const reasons = [];

  for (const rule of rules) {
    if (rule.re.test(haystack)) {
      score += rule.points;
      reasons.push(rule.reason);
    }
  }

  if (lead.website) {
    score += 5;
    reasons.push('Site web disponible');
  }

  if (lead.phone) {
    score += 5;
    reasons.push('Telephone disponible');
  }

  if (lead.rating && Number(lead.rating) >= 4) {
    score += 5;
    reasons.push('Bonne note client');
  }

  if (score > 100) score = 100;

  return {
    score,
    reason: reasons.join('; ') || 'Aucun signal fort',
  };
}

function normalizeLead(rawLead) {
  const address = rawLead.address || null;
  const fallbackCity = pickCityFromAddress(address);

  const normalized = {
    source: rawLead.source,
    sourceId: rawLead.sourceId || null,
    sourceUrl: rawLead.sourceUrl || null,
    name: rawLead.name || null,
    category: rawLead.category || null,
    address,
    postalCode: rawLead.postalCode || fallbackCity.postalCode,
    city: rawLead.city || fallbackCity.city,
    phone: rawLead.phone || null,
    website: rawLead.website || null,
    email: rawLead.email || null,
    latitude: rawLead.latitude ?? null,
    longitude: rawLead.longitude ?? null,
    rating: rawLead.rating ?? null,
    reviewCount: rawLead.reviewCount ?? null,
    searchQuery: rawLead.searchQuery || null,
    rawPayload: rawLead.rawPayload || {},
  };

  const fiber = computeFiberScore(normalized);

  normalized.fiberRelevanceScore = fiber.score;
  normalized.fiberRelevanceReason = fiber.reason;
  normalized.targetSegment = classifyTargetSegment(normalized);
  normalized.dedupeKey = buildDedupeKey(normalized);

  return normalized;
}

module.exports = {
  normalizeLead,
  buildDedupeKey,
  computeFiberScore,
  classifyTargetSegment,
};
