'use strict';

// Mock uuid so Jest doesn't need to parse its ESM build
jest.mock('uuid', () => ({ v4: () => require('crypto').randomUUID() }));

const { generatePlan, computePriorityScore, WEIGHTS } = require('./planGenerator');

// ─── Unit tests for planGenerator.js ─────────────────────────────────────────

describe('computePriorityScore', () => {
  test('weights sum to 1.0', () => {
    const sum = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  test('weak subject scores higher than non-weak (same other params)', () => {
    const base = { difficultyRating:3, confidence:3, daysLeft:30 };
    const weakPS = computePriorityScore({ ...base, isWeak: true });
    const normPS = computePriorityScore({ ...base, isWeak: false });
    expect(weakPS).toBeGreaterThan(normPS);
  });

  test('lower confidence = higher PS (less confident = more priority)', () => {
    const base = { isWeak:false, difficultyRating:3, daysLeft:30 };
    const lowConf  = computePriorityScore({ ...base, confidence: 1 });
    const highConf = computePriorityScore({ ...base, confidence: 5 });
    expect(lowConf).toBeGreaterThan(highConf);
  });

  test('fewer days = higher urgency component', () => {
    const base = { isWeak:false, difficultyRating:3, confidence:3 };
    const soon = computePriorityScore({ ...base, daysLeft: 3 });
    const far  = computePriorityScore({ ...base, daysLeft: 60 });
    expect(soon).toBeGreaterThan(far);
  });

  test('PS is always positive for valid inputs', () => {
    const ps = computePriorityScore({ isWeak:false, difficultyRating:1, confidence:5, daysLeft:365 });
    expect(ps).toBeGreaterThan(0);
  });
});

describe('generatePlan — EMERGENCY MODE', () => {
  const subjects = [
    { name:'Math',    isWeak:true,  difficultyRating:5, topics:['Algebra','Calculus','Trig'] },
    { name:'Physics', isWeak:false, difficultyRating:3, topics:['Mechanics'] },
    { name:'Chem',    isWeak:false, difficultyRating:2, topics:['Organic'] },
    { name:'Bio',     isWeak:false, difficultyRating:2, topics:['Genetics'] },
  ];

  test('exam today (daysLeft=0) → emergencyMode=true', () => {
    const examDate = new Date(); // today
    const result = generatePlan({ examDate, dailyStudyHours:4, subjects });
    expect(result.emergencyMode).toBe(true);
  });

  test('emergency mode returns max 3 topics', () => {
    const examDate = new Date();
    const result = generatePlan({ examDate, dailyStudyHours:4, subjects });
    const allTopics = result.schedule.flatMap((d) => d.topics);
    expect(allTopics.length).toBeLessThanOrEqual(3);
  });

  test('emergency mode returns exactly 1 day in schedule', () => {
    const examDate = new Date();
    const result = generatePlan({ examDate, dailyStudyHours:4, subjects });
    expect(result.schedule.length).toBe(1);
    expect(result.schedule[0].phase).toBe('revision');
  });
});

describe('generatePlan — Normal mode', () => {
  const examDate = new Date();
  examDate.setDate(examDate.getDate() + 30); // 30 days from now

  const subjects = [
    { name:'Math',    isWeak:true,  difficultyRating:5, topics:['Algebra','Calculus'] },
    { name:'Physics', isWeak:false, difficultyRating:3, topics:['Mechanics','Optics'] },
  ];

  test('returns a schedule with multiple days', () => {
    const result = generatePlan({ examDate, dailyStudyHours:4, subjects });
    expect(result.schedule.length).toBeGreaterThan(1);
    expect(result.emergencyMode).toBe(false);
  });

  test('all 3 phases present in schedule', () => {
    const result = generatePlan({ examDate, dailyStudyHours:4, subjects });
    const phases = [...new Set(result.schedule.map((d) => d.phase))];
    expect(phases).toContain('learning');
    expect(phases).toContain('revision');
    expect(phases).toContain('mock');
  });

  test('all scheduled topics have topicId (UUID)', () => {
    const result = generatePlan({ examDate, dailyStudyHours:4, subjects });
    const allTopics = result.schedule.flatMap((d) => d.topics);
    allTopics.forEach((t) => {
      expect(t.topicId).toBeTruthy();
      expect(typeof t.topicId).toBe('string');
    });
  });

  test('all subjects weak — falls back to urgency sort (no crash)', () => {
    const allWeakSubs = subjects.map((s) => ({ ...s, isWeak:true }));
    const result = generatePlan({ examDate, dailyStudyHours:4, subjects: allWeakSubs });
    expect(result.warnings.some((w) => w.includes('urgency-only'))).toBe(true);
    expect(result.schedule.length).toBeGreaterThan(0);
  });

  test('totalTopics matches actual topic count in schedule', () => {
    const result = generatePlan({ examDate, dailyStudyHours:4, subjects });
    const actual = result.schedule.reduce((s, d) => s + d.topics.length, 0);
    expect(result.totalTopics).toBe(actual);
  });

  test('dailyStudyHours=1 — still schedules at least 1 topic per day', () => {
    const result = generatePlan({ examDate, dailyStudyHours:1, subjects });
    result.schedule.forEach((day) => {
      expect(day.topics.length).toBeGreaterThan(0);
    });
  });
});

describe('generatePlan — droppedTopics', () => {
  test('returns droppedTopics array (even if empty)', () => {
    const examDate = new Date(); examDate.setDate(examDate.getDate() + 30);
    const result = generatePlan({
      examDate, dailyStudyHours:4,
      subjects:[{ name:'Math', isWeak:false, difficultyRating:3, topics:['A'] }],
    });
    expect(Array.isArray(result.droppedTopics)).toBe(true);
  });
});
