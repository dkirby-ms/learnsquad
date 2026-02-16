import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();

// In-memory user store for now - PostgreSQL comes later
const users: Map<string, { id: string; email: string; passwordHash: string }> = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const SALT_ROUNDS = 10;

function createToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: 86400 }); // 24 hours in seconds
}

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  email: string;
  password: string;
}

// POST /api/auth/login
router.post('/login', async (req: Request<{}, {}, LoginBody>, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = users.get(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = createToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/register - needed to create users for login to work
router.post('/register', async (req: Request<{}, {}, RegisterBody>, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    if (users.has(email)) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const id = `user_${Date.now()}`;
    
    users.set(email, { id, email, passwordHash });

    const token = createToken({ userId: id, email });

    res.status(201).json({
      token,
      user: { id, email }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
