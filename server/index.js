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
const ADMIN_EMAILS = (process.env.ADMIN_EMAIL || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const BCRYPT_COST = 12;
const VALID_ROLES = new Set(['user', 'admin']);

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

const signToken = (userId, role) =>
  jwt.sign({ uid: userId, role: role || 'user' }, JWT_SECRET, { expiresIn: '7d' });

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.uid;
    req.tokenRole = payload.role || 'user';
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.error('admin check error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'Password must be 8-1024 characters' });

  let client;
  try {
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
    client = await pool.connect();
    await client.query('BEGIN');
    const userResult = await client.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id, role',
      [email, hash, role]
    );
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }
    const userId = userResult.rows[0].id;
    const userRole = userResult.rows[0].role;
    await client.query(
      'INSERT INTO vaults (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [userId]
    );
    await client.query('COMMIT');
    res.status(201).json({ token: signToken(userId, userRole), email, role: userRole });
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
      'SELECT id, email, password_hash, role FROM users WHERE LOWER(email) = $1',
      [email]
    );
    if (result.rows.length === 0) {
      await bcrypt.compare(password, PLACEHOLDER_HASH);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const row = result.rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: signToken(row.id, row.role), email: row.email, role: row.role });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/me', apiLimiter, authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT email, role FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ email: result.rows[0].email, role: result.rows[0].role });
  } catch (err) {
    console.error('me error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/users', apiLimiter, authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.role, u.created_at,
             COALESCE(jsonb_array_length(v.data), 0) AS story_count
      FROM users u
      LEFT JOIN vaults v ON v.user_id = u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      createdAt: r.created_at,
      storyCount: Number(r.story_count) || 0,
    })));
  } catch (err) {
    console.error('admin list users error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/admin/users/:id/role', apiLimiter, authMiddleware, requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  const newRole = req.body?.role;
  if (!VALID_ROLES.has(newRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (targetId === req.userId) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id',
      [newRole, targetId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin role update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/users/:id', apiLimiter, authMiddleware, requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account from the admin panel; use Delete account instead' });
  }
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [targetId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin delete user error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/vault', apiLimiter, authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT data, updated_at FROM vaults WHERE user_id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) return res.json([]);
    const data = result.rows[0].data;
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('vault get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/vault', apiLimiter, authMiddleware, async (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be a JSON array of stories' });
  }
  if (req.body.length > 1000) {
    return res.status(400).json({ error: 'Too many stories' });
  }
  try {
    await pool.query(
      `INSERT INTO vaults (user_id, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET data = EXCLUDED.data, updated_at = NOW()`,
      [req.userId, JSON.stringify(req.body)]
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

async function bootstrapAdmins() {
  if (ADMIN_EMAILS.length === 0) return;
  const result = await pool.query(
    `UPDATE users SET role = 'admin'
     WHERE LOWER(email) = ANY($1::text[]) AND role <> 'admin'
     RETURNING email`,
    [ADMIN_EMAILS]
  );
  if (result.rows.length > 0) {
    console.log('Promoted to admin:', result.rows.map((r) => r.email).join(', '));
  }
}

(async () => {
  try {
    await migrate();
    console.log('Migrations applied');
    await bootstrapAdmins();
    app.listen(PORT, () => console.log(`API listening on :${PORT}`));
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
})();
