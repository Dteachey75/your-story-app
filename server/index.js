require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool, migrate } = require('./db');

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;
const BCRYPT_COST = 12;
const MAX_VAULT_BYTES = 5_000_000;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET env var is required and must be at least 32 characters');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL env var is required');
  process.exit(1);
}

const PLACEHOLDER_HASH = bcrypt.hashSync('placeholder-for-timing', BCRYPT_COST);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '6mb' }));

const allowedOrigins = FRONTEND_URL
  ? FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed'));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
const isValidPassword = (pw) => typeof pw === 'string' && pw.length >= 8 && pw.length <= 1024;

const isValidVault = (v) =>
  v &&
  typeof v.salt === 'string' && v.salt.length > 0 && v.salt.length <= 100 &&
  typeof v.iv === 'string' && v.iv.length > 0 && v.iv.length <= 100 &&
  typeof v.ct === 'string' && v.ct.length > 0 && v.ct.length <= MAX_VAULT_BYTES;

const signToken = (userId) => jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: '7d' });

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const vault = req.body?.vault;

  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'Password must be 8-1024 characters' });
  if (!isValidVault(vault)) return res.status(400).json({ error: 'Vault required' });

  let client;
  try {
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    client = await pool.connect();
    await client.query('BEGIN');
    const userResult = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id',
      [email, hash]
    );
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }
    const userId = userResult.rows[0].id;
    await client.query(
      'INSERT INTO vaults (user_id, salt, iv, ciphertext) VALUES ($1, $2, $3, $4)',
      [userId, vault.salt, vault.iv, vault.ct]
    );
    await client.query('COMMIT');
    res.status(201).json({ token: signToken(userId) });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    console.error('signup error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (client) client.release();
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || !password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  try {
    const result = await pool.query(
      'SELECT id, password_hash FROM users WHERE LOWER(email) = $1',
      [email]
    );
    if (result.rows.length === 0) {
      await bcrypt.compare(password, PLACEHOLDER_HASH);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { id, password_hash } = result.rows[0];
    const ok = await bcrypt.compare(password, password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: signToken(id) });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/vault', apiLimiter, authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT salt, iv, ciphertext, updated_at FROM vaults WHERE user_id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) return res.json(null);
    const row = result.rows[0];
    res.json({ salt: row.salt, iv: row.iv, ct: row.ciphertext, updatedAt: row.updated_at });
  } catch (err) {
    console.error('vault get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/vault', apiLimiter, authMiddleware, async (req, res) => {
  const vault = req.body;
  if (!isValidVault(vault)) return res.status(400).json({ error: 'salt, iv, ct required as strings' });
  try {
    await pool.query(
      `INSERT INTO vaults (user_id, salt, iv, ciphertext, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET salt = EXCLUDED.salt,
             iv = EXCLUDED.iv,
             ciphertext = EXCLUDED.ciphertext,
             updated_at = NOW()`,
      [req.userId, vault.salt, vault.iv, vault.ct]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('vault put error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/account', apiLimiter, authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('account delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.use((err, req, res, next) => {
  if (err && err.message === 'Origin not allowed') {
    return res.status(403).json({ error: 'CORS: origin not allowed' });
  }
  console.error('unhandled error:', err.message);
  res.status(500).json({ error: 'Server error' });
});

(async () => {
  try {
    await migrate();
    console.log('Migrations applied');
    app.listen(PORT, () => console.log(`API listening on :${PORT}`));
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
})();
