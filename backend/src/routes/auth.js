import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { ensureUserRows } from '../services/userData.js';

const router = Router();
const SALT_ROUNDS = 12;

router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email?.trim() || !username?.trim() || !password) {
      return res.status(400).json({ error: 'Email, username, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, role, created_at`,
      [email.trim().toLowerCase(), username.trim(), passwordHash]
    );
    const user = rows[0];
    await ensureUserRows(user.id);

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await pool.query(
      'SELECT id, email, username, password_hash, role FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', requireAuth, (_req, res) => {
  res.json({ message: 'Logged out. Clear your token on the client.' });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows: profileRows } = await pool.query(
    'SELECT display_name FROM profiles WHERE user_id = $1',
    [req.user.id]
  );
  res.json({
    user: {
      ...req.user,
      displayName: profileRows[0]?.display_name || '',
    },
  });
});

export default router;
