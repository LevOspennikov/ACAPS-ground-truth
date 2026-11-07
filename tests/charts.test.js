import test from 'node:test';
import assert from 'node:assert/strict';
import { pieSegments, chartPalette, chartColor, chartColorClass } from '../src/server/charts.js';

const question = { id: 'q1', type: 'single', prompt: 'Risk?', options: ['Low', 'Medium', 'High'] };

test('empty distributions produce no chart segments', () => {
  const chart = pieSegments(question, []);
  assert.equal(chart.total, 0);
  assert.deepEqual(chart.segments, []);
});

test('counts are mapped to the matching option and percent', () => {
  const chart = pieSegments(question, [
    { question_id: 'q1', answer: 'q1-0', total: 3 },
    { question_id: 'q1', answer: 'q1-2', total: 1 },
  ]);
  assert.equal(chart.total, 4);
  assert.deepEqual(chart.segments.map((s) => s.label), ['Low', 'High']);
  assert.deepEqual(chart.segments.map((s) => s.count), [3, 1]);
  assert.deepEqual(chart.segments.map((s) => s.percent), [75, 25]);
  assert.equal(chart.segments[0].color, chartPalette[0]);
});

test('percentages round to 100 when every option is chosen', () => {
  const chart = pieSegments(question, [
    { question_id: 'q1', answer: 'q1-0', total: 1 },
    { question_id: 'q1', answer: 'q1-1', total: 1 },
    { question_id: 'q1', answer: 'q1-2', total: 1 },
  ]);
  assert.deepEqual(chart.segments.map((s) => s.percent), [33, 33, 33]);
});

test('a single unanimous choice fills the full circle', () => {
  const chart = pieSegments(question, [{ question_id: 'q1', answer: 'q1-1', total: 5 }]);
  assert.equal(chart.segments.length, 1);
  assert.equal(chart.segments[0].percent, 100);
  assert.equal(chart.segments[0].dashoffset, '0.000');
});

test('colors cycle when there are more options than palette entries', () => {
  const options = chartPalette.map((_, i) => `Option ${i}`).concat('Extra');
  const many = { id: 'q2', type: 'single', options };
  const distributions = options.map((_, i) => ({ question_id: 'q2', answer: `q2-${i}`, total: 1 }));
  const chart = pieSegments(many, distributions);
  assert.equal(chart.segments[0].color, chartPalette[0]);
  assert.equal(chart.segments[chartPalette.length].color, chartPalette[0]);
});

test('chartColor maps an option index to the same colour as its pie slice', () => {
  assert.equal(chartColor(0), chartPalette[0]);
  assert.equal(chartColor(3), chartPalette[3]);
  assert.equal(chartColor(chartPalette.length), chartPalette[0]);
  assert.equal(pieSegments(question, [{ question_id: 'q1', answer: 'q1-1', total: 1 }]).segments[0].color, chartColor(1));
});

test('chartColorClass maps an index to a CSP-safe class that matches the slice', () => {
  assert.equal(chartColorClass(0), 'chart-color-0');
  assert.equal(chartColorClass(3), 'chart-color-3');
  assert.equal(chartColorClass(chartPalette.length), 'chart-color-0');
  const segment = pieSegments(question, [{ question_id: 'q1', answer: 'q1-1', total: 1 }]).segments[0];
  assert.equal(segment.colorClass, 'chart-color-1');
});
