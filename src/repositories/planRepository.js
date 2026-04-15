'use strict';

const StudyPlan = require('../models/StudyPlan');

/**
 * planRepository — all DB calls for StudyPlan documents.
 *
 * Key decision: updateTopicByTopicId uses positional filtered operator
 * ($[elem]) so updates are O(1) by topicId — no full document rewrite.
 */

const findActiveByUser = (userId) =>
  StudyPlan.findOne({ userId, status: 'active' }).lean();

const findByIdAndUser = (planId, userId) =>
  StudyPlan.findOne({ _id: planId, userId }).lean();

const findAllByUser = (userId) =>
  StudyPlan.find({ userId }).select('-schedule').sort({ createdAt: -1 }).lean();

const create = (data) =>
  StudyPlan.create(data);

const setGeneratingFlag = (planId, value) =>
  StudyPlan.findByIdAndUpdate(planId, { $set: { isGenerating: value } });

/**
 * Update a single TopicItem by its topicId (UUID).
 * Uses MongoDB positional filtered operator for O(1) nested update.
 * arrayFilters tells MongoDB which element in the nested array to target.
 */
const updateTopicByTopicId = (planId, topicId, patch) => {
  const setObj = {};
  for (const [key, val] of Object.entries(patch)) {
    setObj[`schedule.$[day].topics.$[topic].${key}`] = val;
  }
  return StudyPlan.findByIdAndUpdate(
    planId,
    { $set: setObj },
    {
      arrayFilters: [
        { 'day.topics': { $elemMatch: { topicId } } },
        { 'topic.topicId': topicId },
      ],
      new: true,
    }
  ).lean();
};

const updateSchedule = (planId, schedule, extras = {}) =>
  StudyPlan.findByIdAndUpdate(
    planId,
    { $set: { schedule, ...extras } },
    { new: true }
  ).lean();

const archivePlan = (planId, userId) =>
  StudyPlan.findOneAndUpdate(
    { _id: planId, userId },
    { $set: { status: 'archived' } },
    { new: true }
  ).lean();

const updateSettings = (planId, userId, patch) =>
  StudyPlan.findOneAndUpdate(
    { _id: planId, userId },
    { $set: patch },
    { new: true }
  ).lean();

module.exports = {
  findActiveByUser,
  findByIdAndUser,
  findAllByUser,
  create,
  setGeneratingFlag,
  updateTopicByTopicId,
  updateSchedule,
  archivePlan,
  updateSettings,
};
