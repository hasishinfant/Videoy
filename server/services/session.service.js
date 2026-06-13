const sessionModel = require('../models/session.model');
const chatModel = require('../models/chat.model');
const participantModel = require('../models/participant.model');
const visionModel = require('../models/vision.model');
const aiSummaryModel = require('../models/aiSummary.model');
const { generateSessionSummary } = require('./gemini.service');
const { closeRoom } = require('./mediasoup.service');
const logger = require('../utils/logger');

/**
 * End a session: update DB, generate AI summary, close mediasoup room
 */
async function endSession(sessionToken, broadcastFn = null) {
  const session = sessionModel.findByToken(sessionToken);
  if (!session || session.status === 'ended') return null;

  sessionModel.markEnded(sessionToken);
  const updated = sessionModel.findByToken(sessionToken);

  const chatMessages = chatModel.findBySession(session.id);
  const visionDetections = visionModel.findBySession(session.id);

  let aiSummary = null;
  try {
    const result = await generateSessionSummary(chatMessages, visionDetections, updated.duration_secs || 0);
    if (result) {
      // Save to dedicated ai_summaries table
      aiSummaryModel.upsert({
        sessionId: session.id,
        issueIdentified: result.issue_identified,
        productDetected: result.product_detected,
        resolutionSteps: result.resolution_steps,
        resolutionStatus: result.resolution_status,
        actionItems: result.action_items,
        agentPerformanceScore: result.agent_performance_score,
      });
      // Also save JSON to sessions.ai_summary for backward compat
      sessionModel.saveSummary(sessionToken, JSON.stringify(result));
      aiSummary = result;
    }
  } catch (err) {
    logger.error('AI summary failed:', err);
  }

  try {
    closeRoom(sessionToken);
  } catch (err) {
    logger.error('Error closing mediasoup room:', err);
  }

  if (broadcastFn) broadcastFn({ reason: 'session_ended', aiSummary });

  logger.info(`Session ended: ${sessionToken}, duration: ${updated.duration_secs}s`);
  return aiSummary;
}

module.exports = { endSession };
