export function countrySlug(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export function selectCountryRisk(risks, slug, riskId = '') {
  const scoped = risks.filter((risk) => risk.region_slug === slug);
  return (riskId ? scoped.find((risk) => risk.risk_id === riskId) : scoped[0]) || null;
}
