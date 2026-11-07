export const demoQuestionnaire = {
  title: 'Taliban attacks on provincial capitals lead to civil war violence levels, resulting in humanitarian needs for the affected population.',
  context: 'The Afghan government claims to be in a strategic retreat in several Helmand districts, though it is disputed that this is a full scale retreat. Strategic government districts in the province are under attack by the Taliban from several sides.',
  country: 'Afghanistan',
  riskId: 'R0353',
};

export const demoQuestions = [
  { id: 'question-1', type: 'single', prompt: 'Over the coming months, how do you expect the fighting around provincial capitals in Helmand and other contested provinces to evolve?', options: ['Government forces hold the capitals with intermittent clashes', 'Taliban capture one or more provincial capitals', 'Fighting subsides as frontlines freeze', 'Violence escalates to civil-war-level intensity across multiple provinces'] },
  { id: 'question-2', type: 'single', prompt: 'How likely is it that the Taliban will take control of a provincial capital in the coming months?', options: ['Unlikely', 'Possible', 'Likely', 'Very likely'] },
  { id: 'question-3', type: 'single', prompt: 'If Taliban offensives on provincial capitals intensify, which humanitarian consequence do you consider most serious?', options: ['Mass displacement from cities and districts under attack', 'Civilian casualties from shelling and urban fighting', 'Disruption of health services and casualty treatment', 'Loss of food supply routes and market access'] },
  { id: 'question-4', type: 'single', prompt: 'Which population group do you expect to be most affected by intensified fighting around provincial capitals?', options: ['Displaced families fleeing rural districts', 'Residents trapped inside besieged cities', 'Wounded civilians lacking access to hospitals', 'Farmers cut off from land and livelihoods'] },
  { id: 'question-5', type: 'single', prompt: 'How do you expect humanitarian access in Helmand and neighbouring provinces to evolve in the coming months?', options: ['Access largely maintained through negotiation', 'Access increasingly constrained by active frontlines', 'Access severely restricted in besieged areas', 'Access improves as fighting de-escalates'] },
  { id: 'question-6', type: 'text', prompt: 'What did we miss?', placeholder: 'Add any context or evidence we should consider.' },
];

// Synthetic, non-identifying profiles. Choices are option indexes for the five
// single-choice questions, in order; note is the free-text answer.
export const demoExperts = [
  { pseudonym: 'Helmand Analyst', choices: [3, 3, 0, 1, 2], note: 'Clashes have already displaced families from several districts; food prices are rising in Lashkar Gah.' },
  { pseudonym: 'Kabul Observer', choices: [1, 2, 1, 0, 1], note: 'Frontline movements near the Ring Road are restricting supply convoys.' },
  { pseudonym: 'Field Researcher', choices: [1, 3, 0, 0, 2], note: 'Civilian casualty reporting remains patchy and needs monitoring in besieged districts.' },
  { pseudonym: 'Access Specialist', choices: [3, 3, 3, 2, 2], note: 'Negotiated access is breaking down as frontlines shift.' },
  { pseudonym: 'Health Coordinator', choices: [0, 1, 2, 2, 0], note: 'Hospitals are receiving wounded patients but face shortages of surgical supplies.' },
  { pseudonym: 'Protection Officer', choices: [1, 2, 1, 3, 1], note: 'Farmers are being cut off from the harvest in contested areas.' },
  { pseudonym: 'Livelihoods Advisor', choices: [3, 3, 0, 0, 2], note: 'Mass displacement into provincial centres is straining services.' },
  { pseudonym: 'Regional Monitor', choices: [2, 1, 3, 1, 1], note: 'Market access and food supply routes are the main concern.' },
];

export function buildAnswers(questions, expert) {
  const answers = {};
  let choiceIndex = 0;
  for (const question of questions) {
    if (question.type === 'single') answers[question.id] = `${question.id}-${expert.choices[choiceIndex++]}`;
    else answers[question.id] = expert.note;
  }
  return answers;
}
