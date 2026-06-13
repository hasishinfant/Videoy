const bcrypt = require('bcryptjs');
const userModel = require('../models/user.model');
const { signToken } = require('../services/token.service');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const agent = userModel.findByEmail(email);
    if (!agent) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ sub: agent.id, email: agent.email, name: agent.name, role: agent.role });
    res.json({ token, user: { id: agent.id, name: agent.name, email: agent.email, role: agent.role } });
  } catch (err) { next(err); }
}

async function register(req, res, next) {
  try {
    const { name, email, password, role = 'agent' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });

    const existing = userModel.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = userModel.create({ name, email, passwordHash, role });
    const token = signToken({ sub: user.id, email: user.email, name: user.name, role: user.role });
    res.status(201).json({ token, user });
  } catch (err) { next(err); }
}

function me(req, res) {
  const user = userModel.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}

module.exports = { login, register, me };
