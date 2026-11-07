export const chartPalette = [
  '#235f47',
  '#547d35',
  '#d58936',
  '#3a7ca5',
  '#8f5aa8',
  '#b0523a',
  '#5f8a5f',
  '#c9a227',
];

// Single source of truth for mapping an option index to its chart colour, so
// answer swatches always match the slice they belong to.
export function chartColor(index, palette = chartPalette) {
  return palette[index % palette.length];
}

// Build donut-chart segments for a single-choice question from its per-option
// counts. Returns stroke-based SVG geometry the page can render without any
// client JavaScript.
export function pieSegments(question, distributions, palette = chartPalette) {
  const options = Array.isArray(question.options) ? question.options : [];
  const counts = options.map((label, i) => ({
    label,
    count: distributions.find((d) => d.question_id === question.id && d.answer === `${question.id}-${i}`)?.total || 0,
  }));
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const size = 44;
  const center = size / 2;
  const radius = 15;
  const width = 14;
  const circumference = +(2 * Math.PI * radius).toFixed(3);
  const segments = [];
  if (total > 0) {
    let cumulative = 0;
    counts.forEach((c, i) => {
      if (!c.count) return;
      const fraction = c.count / total;
      const length = fraction * circumference;
      segments.push({
        label: c.label,
        count: c.count,
        percent: Math.round(fraction * 100),
        color: chartColor(i, palette),
        dasharray: `${length.toFixed(3)} ${(circumference - length).toFixed(3)}`,
        dashoffset: (-cumulative * circumference).toFixed(3),
      });
      cumulative += fraction;
    });
  }
  return { total, size, center, radius, width, circumference, segments };
}
