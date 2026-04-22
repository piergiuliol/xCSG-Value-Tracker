// metric-details.js — data-only copy for metric info panels.
// Loaded before app.js via index.html so window.METRIC_DETAILS is available
// to the renderers.
window.METRIC_DETAILS = {
  delivery_speed: {
    label: 'Delivery Speed', icon: '⚡', format: 'ratio', section: 'core',
    what: 'How much faster xCSG delivers compared to legacy methods. Measures total effort in person-days.',
    formula: 'Legacy person-days ÷ xCSG person-days',
    formulaDetail: 'Person-days = working days × team size',
    sources: {
      xcsg: 'Working days × Team size (project configuration)',
      legacy: 'L1 (legacy working days) × L2 (legacy team size) from expert survey',
      note: 'Expert survey data takes precedence over project configuration.'
    },
    example: {
      rows: [
        ['Working days', '5', '15'],
        ['Team size', '2', '3'],
        ['Person-days', '10', '45'],
      ],
      result: '4.5×',
      resultLabel: 'Delivery Speed'
    },
    howToRead: '4.5× means xCSG delivered in less than a quarter of the effort. Values above 1× indicate xCSG advantage.'
  },
  output_quality: {
    label: 'Output Quality', icon: '⭐', format: 'ratio', section: 'core',
    what: 'xCSG output quality relative to legacy, based on expert self-assessment, analytical depth, and decision readiness.',
    formula: 'xCSG quality score ÷ Legacy quality score',
    formulaDetail: 'Quality = average of scored quality dimensions. Exceptional=1.0, Strong=0.75, Adequate=0.4, Superficial=0.1',
    sources: {
      xcsg: 'Average of C6 (self-assessment), C7 (analytical depth), C8 (decision readiness)',
      legacy: 'Average of L13 (legacy analytical depth), L14 (legacy decision readiness)',
      note: 'Each option maps to a 0–1 score; the ratio compares the two averages.'
    },
    example: {
      rows: [
        ['Quality components', 'C6=1.0, C7=0.75, C8=1.0', 'L13=0.4, L14=0.2'],
        ['Average quality', '0.92', '0.30'],
      ],
      result: '3.07×',
      resultLabel: 'Output Quality'
    },
    howToRead: '3.07× means xCSG output quality is roughly three times higher. Values above 1× indicate better quality.'
  },
  productivity_ratio: {
    label: 'xCSG Value Gain', icon: '🎯', format: 'ratio', section: 'core',
    what: 'The primary metric. Compares quality per unit of effort between xCSG and legacy delivery.',
    formula: '(xCSG quality ÷ xCSG person-days) ÷ (Legacy quality ÷ Legacy person-days)',
    formulaDetail: 'Quality per person-day ratio — how much value is produced per unit of effort.',
    sources: {
      xcsg: 'Quality score (avg of C6, C7, C8) ÷ person-days (working days × team size)',
      legacy: 'Quality score (avg of L13, L14) ÷ person-days (L1 × L2)',
      note: 'This is the ratio of ratios: combines speed and quality into one number.'
    },
    example: {
      rows: [
        ['Quality score', '0.92', '0.30'],
        ['Person-days', '10', '45'],
        ['Quality / person-day', '0.092', '0.0067'],
      ],
      result: '13.8×',
      resultLabel: 'xCSG Value Gain'
    },
    howToRead: '13.8× means xCSG produces nearly 14 times more quality per unit of effort. This is the single most important metric.'
  },
  rework_efficiency: {
    label: 'Rework Efficiency', icon: '🔧', format: 'ratio', section: 'core',
    what: 'How smoothly xCSG delivers compared to legacy. Combines revision depth, scope expansion, and client reaction.',
    formula: 'xCSG smoothness ÷ Legacy smoothness',
    formulaDetail: 'Smoothness = average of revision depth score, scope expansion score, and client pulse score.',
    sources: {
      xcsg: 'Revision depth, scope expansion, client pulse (project fields)',
      legacy: 'L3 (legacy revision depth), L4 (legacy scope expansion), L5 (legacy client reaction)',
      note: 'Higher smoothness scores mean fewer revisions and better client reception.'
    },
    example: {
      rows: [
        ['Revision depth', '1.0 (none)', '0.55 (moderate)'],
        ['Scope expansion', '0.0 (no)', '0.0 (no)'],
        ['Client pulse', '0.6 (met)', '0.6 (met)'],
        ['Average smoothness', '0.53', '0.38'],
      ],
      result: '1.39×',
      resultLabel: 'Rework Efficiency'
    },
    howToRead: '1.39× means xCSG delivery was smoother with less rework. Above 1× = xCSG advantage.'
  },
  machine_first_score: {
    label: 'Machine-First Gain', icon: '🤖', format: 'ratio', section: 'flywheel',
    what: 'Breadth of knowledge synthesis in xCSG vs legacy. Measures how many sources were synthesized.',
    formula: 'B2 score ÷ L6 score',
    formulaDetail: 'B2: "How many knowledge sources synthesized?" Scoring: Single source=0.25, Few (2–4)=0.5, Multiple (5–10)=0.75, Broad (10+)=1.0',
    sources: {
      xcsg: 'B2 — Knowledge sources synthesized (xCSG approach)',
      legacy: 'L6 — Same question for legacy approach',
      note: 'Directly compares the breadth of AI-augmented research vs traditional.'
    },
    example: {
      rows: [
        ['Sources synthesized', 'Broad (10+) = 1.0', 'Few (2–4) = 0.5'],
      ],
      result: '2.0×',
      resultLabel: 'Machine-First Gain'
    },
    howToRead: '2.0× means xCSG synthesized twice as many knowledge sources. Higher = more automation leverage.'
  },
  senior_led_score: {
    label: 'Senior-Led Gain', icon: '👔', format: 'ratio', section: 'flywheel',
    what: 'Average of three ratios measuring senior expert involvement depth in xCSG vs legacy.',
    formula: 'Average of 3 ratios: C1/L7, C2/L8, C3/L9',
    formulaDetail: 'C1: Specialization (Deep=1.0, Adjacent=0.5, Generalist=0.0). C2: Directness (Authored=1.0, Co-authored=0.5, Reviewed=0.0). C3: Judgment % (>75%=1.0, 50–75%=0.75, 25–50%=0.5, <25%=0.25). When legacy=0 but xCSG>0, ratio caps at 10×.',
    sources: {
      xcsg: 'C1 (specialization), C2 (directness), C3 (judgment %)',
      legacy: 'L7 (legacy specialization), L8 (legacy directness), L9 (legacy judgment %)',
      note: 'Each pair is compared as a ratio, then the three ratios are averaged.'
    },
    example: {
      rows: [
        ['Specialization (C1/L7)', 'Deep = 1.0', 'Generalist = 0.0 → 10× cap'],
        ['Directness (C2/L8)', 'Authored = 1.0', 'Co-authored = 0.5 → 2×'],
        ['Judgment (C3/L9)', '>75% = 1.0', '<25% = 0.25 → 4×'],
      ],
      result: '5.33×',
      resultLabel: 'Senior-Led Gain (avg of 10, 2, 4)'
    },
    howToRead: '5.33× means senior experts were far more deeply involved in xCSG. Higher = more expert-driven work.'
  },
  proprietary_knowledge_score: {
    label: 'Knowledge Gain', icon: '🏰', format: 'ratio', section: 'flywheel',
    what: 'Proprietary knowledge advantage. Averages three ratios: proprietary data use, knowledge reuse, and competitive moat.',
    formula: 'Average of 3 ratios: D1/L10, D2/L11, D3/L12',
    formulaDetail: 'D1: Proprietary data (Yes=1.0, No=0.0). D2: Knowledge reuse (Reused & extended=1.0, Useful context=0.5, From scratch=0.0). D3: Moat test (Proprietary decisive=1.0, Partially=0.5, All public=0.0). Same 10× cap when legacy=0.',
    sources: {
      xcsg: 'D1 (proprietary data), D2 (knowledge reuse), D3 (moat test)',
      legacy: 'L10 (legacy proprietary data), L11 (legacy reuse), L12 (legacy moat)',
      note: 'Measures how hard the deliverable would be to replicate without xCSG.'
    },
    example: {
      rows: [
        ['Proprietary data (D1/L10)', 'Yes = 1.0', 'No = 0.0 → 10× cap'],
        ['Knowledge reuse (D2/L11)', 'Extended = 1.0', 'Scratch = 0.0 → 10× cap'],
        ['Moat test (D3/L12)', 'Decisive = 1.0', 'Public = 0.0 → 10× cap'],
      ],
      result: '10.0×',
      resultLabel: 'Knowledge Gain (avg of 10, 10, 10)'
    },
    howToRead: '10.0× means xCSG had a massive proprietary knowledge advantage. Higher = harder to replicate.'
  },
  client_impact: {
    label: 'Client Impact', icon: '💥', format: 'ratio', section: 'flywheel',
    what: 'Did xCSG work drive client decisions more effectively than legacy would have?',
    formula: 'E1 score ÷ L15 score (capped at 10×)',
    formulaDetail: 'E1: Informed decision=1.0, Referenced=0.6, Too early=null (excluded), No=0.1.',
    sources: {
      xcsg: 'E1 — Did the deliverable inform a client decision?',
      legacy: 'L15 — Would the traditional version have driven the same decision?',
      note: 'Ratio is capped at 10×. "Too early to tell" responses are excluded.'
    },
    example: {
      rows: [
        ['Decision influence', 'Informed decision = 1.0', 'No = 0.1'],
      ],
      result: '10.0×',
      resultLabel: 'Client Impact (capped)'
    },
    howToRead: '10.0× (capped) means xCSG drove significantly more client action. Higher = stronger decision influence.'
  },
  data_independence: {
    label: 'Data Independence', icon: '📊', format: 'ratio', section: 'flywheel',
    what: 'How efficiently xCSG uses data compared to legacy. Less time on sourcing, more on analysis and insight.',
    formula: 'B6 score ÷ L16 score',
    formulaDetail: 'B6: <25% on data=1.0, 25–50%=0.75, 50–75%=0.4, >75% on data=0.1.',
    sources: {
      xcsg: 'B6 — What % of effort went to data sourcing vs analysis?',
      legacy: 'L16 — What % of time would traditional delivery spend on data sourcing?',
      note: 'Higher = more time on insight generation rather than data collection.'
    },
    example: {
      rows: [
        ['Data sourcing effort', '<25% = 1.0', '>75% = 0.1'],
      ],
      result: '10.0×',
      resultLabel: 'Data Independence'
    },
    howToRead: '10.0× means xCSG spent far less time on data collection. Higher = more insight per data effort.'
  },
  reuse_intent_avg: {
    label: 'Reuse Intent', icon: '🔄', format: 'pct', section: 'signal',
    what: 'Expert loyalty signal. Would they choose the xCSG approach again for this type of deliverable?',
    formula: 'Average of G1 scores across all experts',
    formulaDetail: '"Yes without hesitation" = 100%, "Yes with reservations" = 50%, "No" = 0%.',
    sources: {
      xcsg: 'G1 — Would you choose the xCSG approach again?',
      legacy: 'N/A (this is a forward-looking signal metric)',
      note: 'Aggregated across all expert responses for the portfolio.'
    },
    example: {
      rows: [
        ['Expert 1', 'Yes without hesitation', '100%'],
        ['Expert 2', 'Yes with reservations', '50%'],
        ['Expert 3', 'Yes without hesitation', '100%'],
      ],
      result: '83%',
      resultLabel: 'Reuse Intent (average)'
    },
    howToRead: '83% means most experts would enthusiastically reuse xCSG. Target: 70%+ for the adoption confidence scaling gate.'
  },
  ai_survival_avg: {
    label: 'AI Survival', icon: '🌍', format: 'pct', section: 'signal',
    what: 'How much of the initial AI-generated draft survived into the final deliverable unchanged.',
    formula: 'Average of B5 scores across all experts',
    formulaDetail: '">75%" = 100%, "50–75%" = 75%, "25–50%" = 50%, "<25%" = 25%.',
    sources: {
      xcsg: 'B5 — What % of the AI draft survived into the final deliverable?',
      legacy: 'N/A (legacy does not use AI drafts)',
      note: 'Higher = AI produced better starting material that required less rework.'
    },
    example: {
      rows: [
        ['Expert 1', '>75%', '100%'],
        ['Expert 2', '50–75%', '75%'],
      ],
      result: '88%',
      resultLabel: 'AI Survival (average)'
    },
    howToRead: '88% means most AI-generated content survived review. Higher = better AI starting quality.'
  },
  client_pulse_avg: {
    label: 'Client Pulse', icon: '❤', format: 'pct', section: 'signal',
    what: 'How clients rated the deliverable. An aggregate satisfaction signal.',
    formula: 'Average of client pulse scores across all projects',
    formulaDetail: '"Exceeded expectations" = 100%, "Met expectations" = 60%, "Below expectations" = 10%.',
    sources: {
      xcsg: 'Client Pulse field on each project',
      legacy: 'N/A (this is the actual client reaction to xCSG delivery)',
      note: 'Set by the PMO team based on client feedback, not by expert survey.'
    },
    example: {
      rows: [
        ['Project Alpha', 'Exceeded expectations', '100%'],
        ['Project Beta', 'Met expectations', '60%'],
      ],
      result: '80%',
      resultLabel: 'Client Pulse (average)'
    },
    howToRead: '80% means clients are generally very satisfied. Target: consistent "exceeded" or "met" ratings.'
  },
  on_time_delivery_pct: {
    label: 'On-Time Delivery', icon: '⏱', format: 'pct', section: 'signal',
    what: 'Proportion of projects delivered on or before their expected date. Tracks schedule discipline across the portfolio.',
    formula: 'Projects delivered on/before expected ÷ Projects with both dates',
    formulaDetail: 'Only counts projects that have BOTH a date_expected_delivered and a date_delivered. A project is on time when actual ≤ expected (same day or earlier).',
    sources: {
      xcsg: 'date_expected_delivered and date_delivered fields on each project',
      legacy: 'N/A (this is an operational signal on xCSG delivery only)',
      note: 'Tile sub-label shows the average schedule delta across tracked projects (e.g. "avg 0.3d early").'
    },
    example: {
      rows: [
        ['Project Alpha', 'Expected 2026-04-10, delivered 2026-04-08', 'On time'],
        ['Project Beta', 'Expected 2026-04-15, delivered 2026-04-18', 'Late'],
      ],
      result: '50%',
      resultLabel: 'On-Time Delivery (2 tracked)'
    },
    howToRead: '90% means 9 of 10 tracked projects landed on or before their expected date. Target: ≥80%. Projects without an expected date are excluded from the denominator.'
  },
};
