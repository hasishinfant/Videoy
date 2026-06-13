const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const INVITE_SECRET = process.env.INVITE_JWT_SECRET || 'invite_secret';
const INVITE_EXPIRES = process.env.INVITE_EXPIRES_IN || '24h';

/**
 * Generate a cryptographically unique session token (used in invite URLs)
 */
function generateSessionToken() {
  return uuidv4().replace(/-/g, '');
}

/**
 * Generate a signed invite JWT for a customer
 * @param {string} sessionToken
 * @returns {string} signed JWT
 */
function generateInviteJWT(sessionToken) {
  return jwt.sign(
    { sessionToken, role: 'customer' },
    INVITE_SECRET,
    { expiresIn: INVITE_EXPIRES }
  );
}

/**
 * Verify an invite JWT
 * @param {string} token
 * @returns {object} decoded payload or throws
 */
function verifyInviteJWT(token) {
  return jwt.verify(token, INVITE_SECRET);
}

/**
 * Build a full invite URL for a session
 * @param {string} sessionToken
 * @param {string} baseUrl - e.g. http://localhost:5173
 * @returns {{ inviteUrl: string, inviteJWT: string }}
 */
function buildInviteLink(sessionToken, baseUrl = process.env.CLIENT_URL || 'http://localhost:5173') {
  const inviteJWT = generateInviteJWT(sessionToken);
  const inviteUrl = `${baseUrl}/join/${sessionToken}?t=${inviteJWT}`;
  return { inviteUrl, inviteJWT };
}

module.exports = { generateSessionToken, generateInviteJWT, verifyInviteJWT, buildInviteLink };
