'use strict';

const { generatePlan } = require('./planGenerator');
const planRepository   = require('../repositories/planRepository');
const userRepository   = require('../repositories/userRepository');

/**
 * planService.js — Orchestrates plan creation.
 *
 * Responsibilities:
 *  1. Check for existing active plan (409 Conflict if found)
 *  2. Set isGenerating lock atomically
 *  3. Call planGenerator (pure fn)
 *  4. Persist result via planRepository
 *  5. Update user stats
 *  6. Release lock
 */
async function createPlan(userId, { title, examDate, dailyStudyHours, subjects, goal }) {
  // 1. Concurrency check — prevent duplicate concurrent generations
  const existing = await planRepository.findActiveByUser(userId);
  if (existing) {
    const err = new Error('You already have an active plan. Archive it before creating a new one.');
    err.statusCode = 409;
    err.code = 'PLAN_ALREADY_ACTIVE';
    throw err;
  }

  // Validate exam date is in the future (belt-and-suspenders; validate.js also checks)
  if (new Date(examDate) <= new Date()) {
    const err = new Error('Exam date must be in the future.');
    err.statusCode = 400;
    err.code = 'INVALID_DATE';
    throw err;
  }

  // 2. Create a placeholder plan and set isGenerating flag
  let plan = await planRepository.create({
    userId,
    title,
    examDate,
    dailyStudyHours,
    subjects,
    goal: goal || {},
    status: 'active',
    isGenerating: true,
    schedule: [],
    totalTopics: 0,
  });

  try {
    // 3. Generate schedule (CPU-bound, pure function)
    const result = generatePlan({ examDate, dailyStudyHours, subjects });

    // 4. Persist schedule
    plan = await planRepository.updateSchedule(plan._id, result.schedule, {
      totalTopics: result.totalTopics,
      emergencyMode: result.emergencyMode,
      droppedTopics: result.droppedTopics,
      warnings: result.warnings,
      isGenerating: false,
    });

    // 5. Update user stats
    await userRepository.incrementPlansCreated(userId);

    return plan;
  } catch (err) {
    // Release lock on failure
    await planRepository.setGeneratingFlag(plan._id, false);
    throw err;
  }
}

module.exports = { createPlan };
