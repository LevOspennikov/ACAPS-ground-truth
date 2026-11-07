import { pieSegments, chartColor } from '../server/charts.js';

const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

// Server-rendered result cards. Every text value is escaped before HTML insertion.
export function resultsMarkup(questions, { withheldMessage = 'Results will appear once enough experts have responded.' } = {}) {
  if (!questions.length) return '<p>There are no choice questions to summarise. Written responses stay private.</p>';
  return questions.map((question) => {
    const heading = `<h3>${escape(question.prompt)}</h3>`;
    if (question.withheld) return `<section class="result-card">${heading}<p>${escape(withheldMessage)}</p></section>`;
    const chart = pieSegments({ id: question.id, options: question.options.map((option) => option.label) }, question.options.map((option, index) => ({ question_id: question.id, answer: `${question.id}-${index}`, total: option.count })));
    const description = question.options.map((option) => `${option.label}: ${option.count} (${option.percent}%)`).join(', ');
    const svg = chart.total ? `<svg class="result-pie" viewBox="0 0 ${chart.size} ${chart.size}" role="img" aria-label="${escape(description)}">${chart.segments.map((segment) => `<circle cx="${chart.center}" cy="${chart.center}" r="${chart.radius}" fill="none" stroke="${segment.color}" stroke-width="${chart.width}" stroke-dasharray="${segment.dasharray}" stroke-dashoffset="${segment.dashoffset}" transform="rotate(-90 ${chart.center} ${chart.center})" />`).join('')}</svg>` : '<p>No answers yet.</p>';
    const legend = `<dl class="result-legend">${question.options.map((option, index) => `<div><dt><svg class="result-swatch" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill="${chartColor(index)}" /></svg>${escape(option.label)}</dt><dd>${escape(option.count)} · ${escape(option.percent)}%</dd></div>`).join('')}</dl>`;
    return `<section class="result-card">${heading}<p>${escape(question.total)} submitted ${question.total === 1 ? 'answer' : 'answers'}</p><div class="result-distribution">${svg}${legend}</div></section>`;
  }).join('');
}
