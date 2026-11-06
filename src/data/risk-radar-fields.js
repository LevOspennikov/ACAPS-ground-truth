// Keep every CSV column as text so blanks, ranges and source formatting survive.
export const riskRadarFields = [
  ['risk_id', 'Risk ID', 40, true],
  ['risk_title', 'Risk Title', 1000, true],
  ['risk_type', 'Risk Type', 200],
  ['iso', 'ISO', 3],
  ['country', 'Country', 150, true],
  ['rationale', 'Rationale', 50000],
  ['source', 'Source', 50000],
  ['intensity_of_hazard', 'Intensity of hazard', 100],
  ['impact', 'Impact', 100],
  ['probability', 'Probability', 100],
  ['risk_level', 'Risk Level', 100],
  ['risk_trend', 'Risk trend', 100],
  ['status', 'Status', 100],
  ['what_materialised', 'What materialised?', 10000],
  ['hazard_materialisation', 'Hazard materialisation', 50000],
  ['materialisation_sources', 'Materialisation sources', 50000],
  ['triggers', 'Triggers', 50000],
  ['current_vulnerability', 'Current vulnerability / Coping capacities', 50000],
  ['current_vulnerability_sources', 'Current vulnerability / Coping capacities sources', 50000],
  ['expected_exposure', 'Expected exposure', 200],
  ['expected_impact', 'Expected impact', 50000],
  ['expected_impact_sources', 'Expected impact sources', 50000],
  ['expected_priority_needs', 'Expected priority needs', 2000],
  ['impact_materialisation_description', 'Impact materialisation description', 50000],
  ['rationale_update', 'Rationale update', 50000],
].map(([key, label, max, required = false]) => ({ key, label, max, required }));
export const riskRadarSummaryKeys = ['risk_id', 'risk_title', 'country', 'iso', 'risk_type', 'status', 'probability', 'risk_level', 'rationale'];

export function validateRiskRadar(form) {
  const record = {};
  for (const field of riskRadarFields) {
    const value = form.get(field.key) ?? '';
    if (typeof value !== 'string' || value.length > field.max || (field.required && !value.trim())) throw new Error(`Check ${field.label}: ${field.required ? 'required, ' : ''}maximum ${field.max} characters.`);
    record[field.key] = value.trim();
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(record.risk_id)) throw new Error('Risk ID must use letters, numbers, dots, underscores or hyphens.');
  if (record.iso && !/^[A-Za-z]{3}$/.test(record.iso)) throw new Error('ISO must be a three-letter country code, or blank.');
  record.iso = record.iso.toUpperCase();
  return record;
}
