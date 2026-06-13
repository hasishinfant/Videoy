const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

let genAI = null;

function getClient() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      logger.warn('GEMINI_API_KEY not set — Gemini features will return null');
      return null;
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function getModel(vision = false) {
  const client = getClient();
  if (!client) return null;
  return client.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

function cleanJSON(text) {
  return text
    .replace(/^```json?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

/**
 * Analyze a video frame (base64 JPEG) using Gemini Vision
 * @param {string} base64Image - base64-encoded JPEG (no data URI prefix)
 * @returns {{ product: string, issue: string, confidence: number } | null}
 */
async function analyzeVideoFrame(base64Image) {
  const model = getModel(true);
  if (!model) return null;

  const prompt = `You are a support assistant analyzing a screenshot from a customer's video call.
Analyze this image and return a JSON object ONLY (no markdown, no explanation):
{
  "product": "name of product/device visible, or 'Unknown' if none",
  "issue": "brief description of visible damage, error, or issue, or 'None visible' if none",
  "confidence": <integer 0-100 confidence score>
}`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
    ]);
    const text = result.response.text().trim();
    const parsed = JSON.parse(cleanJSON(text));
    return {
      product: parsed.product || 'Unknown',
      issue: parsed.issue || 'None visible',
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 0)),
    };
  } catch (err) {
    logger.error('analyzeVideoFrame failed:', err.message);
    return null;
  }
}

/**
 * Generate a structured post-call case record
 * @param {Array} chatMessages
 * @param {Array} visionDetections
 * @param {number} durationSecs
 * @returns {object | null}
 */
async function generateSessionSummary(chatMessages, visionDetections = [], durationSecs = 0) {
  const model = getModel();
  if (!model) return null;

  const transcript = chatMessages.length > 0
    ? chatMessages.map((m) => `[${m.sender_role?.toUpperCase() || m.senderRole?.toUpperCase()}] ${m.sender_name || m.senderName}: ${m.message}`).join('\n')
    : '(No chat messages)';

  const detections = visionDetections.length > 0
    ? visionDetections.map((d) => `• ${d.detected_product} — ${d.detected_issue} (${d.confidence}%)`).join('\n')
    : '(No visual detections)';

  const prompt = `You are a support call analyst. Return ONLY a JSON object (no markdown).

Chat transcript (${durationSecs}s session):
${transcript}

Visual AI detections during call:
${detections}

Return this exact JSON:
{
  "issue_identified": "main problem in one sentence",
  "product_detected": "product name or 'Unknown'",
  "resolution_steps": ["step1", "step2"],
  "resolution_status": "resolved" | "escalated" | "unresolved",
  "action_items": ["item1"],
  "agent_performance_score": <0-100 integer>,
  "summary": "2-3 sentence narrative"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = JSON.parse(cleanJSON(text));
    return {
      issue_identified: parsed.issue_identified || 'Unknown issue',
      product_detected: parsed.product_detected || 'Unknown',
      resolution_steps: Array.isArray(parsed.resolution_steps) ? parsed.resolution_steps : [],
      resolution_status: ['resolved', 'escalated', 'unresolved'].includes(parsed.resolution_status)
        ? parsed.resolution_status : 'unresolved',
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
      agent_performance_score: Math.min(100, Math.max(0, parseInt(parsed.agent_performance_score) || 70)),
      summary: parsed.summary || '',
    };
  } catch (err) {
    logger.error('generateSessionSummary failed:', err.message);
    return null;
  }
}

/**
 * Get real-time copilot suggestion for agent
 * @param {Array} chatHistory
 * @param {Array} visionDetections
 * @param {string} agentQuestion
 * @returns {{ suggestion: string, escalate: boolean, confidence: number } | null}
 */
async function getCopilotSuggestion(chatHistory, visionDetections, agentQuestion) {
  const model = getModel();
  if (!model) return null;

  const transcript = chatHistory.slice(-20)
    .map((m) => `[${(m.sender_role || m.senderRole || '').toUpperCase()}] ${m.sender_name || m.senderName}: ${m.message}`)
    .join('\n') || '(No messages yet)';

  const detections = visionDetections.slice(-5)
    .map((d) => `${d.detected_product} — ${d.detected_issue} (${d.confidence}%)`)
    .join('\n') || '(No visual data)';

  const prompt = `You are an AI copilot assisting a support agent in real-time.

Recent chat:
${transcript}

Visual detections:
${detections}

Agent's question: "${agentQuestion}"

Return ONLY this JSON:
{
  "suggestion": "specific actionable advice for the agent (2-3 sentences)",
  "escalate": <true if issue requires escalation, false otherwise>,
  "confidence": <0-100 integer>
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = JSON.parse(cleanJSON(text));
    return {
      suggestion: parsed.suggestion || 'Unable to generate suggestion',
      escalate: Boolean(parsed.escalate),
      confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
    };
  } catch (err) {
    logger.error('getCopilotSuggestion failed:', err.message);
    return null;
  }
}

module.exports = { analyzeVideoFrame, generateSessionSummary, getCopilotSuggestion };
