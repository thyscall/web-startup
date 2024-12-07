const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { getUser, getUserByToken, createUser } = require('./database.js');
const apiConfig = require('./apiConfig.json'); // Import API config

const app = express();
const port = process.argv[2] || 4000;
const authCookieName = 'token'; // Matches Simon example

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
app.set('trust proxy', true);

// Helper to set authentication cookie
function setAuthCookie(res, authToken) {
  res.cookie(authCookieName, authToken, {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
  });
}

// API Routes
const apiRouter = express.Router();
app.use('/api', apiRouter);

// User creation
apiRouter.post('/auth/create', async (req, res) => {
    const { email, password } = req.body;
    try {
      if (await getUser(email)) {
        return res.status(409).json({ msg: 'User already exists' });
      }
  
      const user = await createUser(email, password);
      setAuthCookie(res, user.token); // Optional: Set a cookie for immediate login
      res.status(201).json({ id: user._id });
    } catch (error) {
      res.status(500).json({ msg: 'Error creating user', error: error.message });
    }
  });

// User login
apiRouter.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await getUser(email);
  if (user && await bcrypt.compare(password, user.password)) {
    setAuthCookie(res, user.token);
    res.status(200).json({ id: user._id });
  } else {
    res.status(401).json({ msg: 'Unauthorized' });
  }
});

// User logout
apiRouter.delete('/auth/logout', (_req, res) => {
  res.clearCookie(authCookieName);
  res.status(204).end();
});

// Secure middleware
const secureApiRouter = express.Router();
apiRouter.use(secureApiRouter);

secureApiRouter.use(async (req, res, next) => {
  const authToken = req.cookies[authCookieName];
  const user = await getUserByToken(authToken);
  if (user) {
    req.user = user; // Attach user data
    next();
  } else {
    res.status(401).json({ msg: 'Unauthorized' });
  }
});

// Helper to fetch Premier League standings using dynamic import
async function fetchPremierLeagueStandings() {
  const { default: fetch } = await import('node-fetch'); // Dynamically import node-fetch
  const url = `https://api.football-data.org/v2/competitions/PL/standings`;

  const response = await fetch(url, {
    headers: { 'X-Auth-Token': apiConfig.premierLeagueApiKey },
  });

  if (!response.ok) {
    throw new Error(`Error fetching standings: ${response.statusText}`);
  }

  return await response.json();
}

// Premier League Standings API call
secureApiRouter.get('/premier-league-standings', async (req, res) => {
  try {
    const data = await fetchPremierLeagueStandings();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching Premier League standings:', error.message);
    res.status(500).json({ msg: 'Error fetching standings', error: error.message });
  }
});

// Example secure route
secureApiRouter.get('/user-info', (req, res) => {
  res.json({ email: req.user.email, id: req.user._id });
});

// Start service
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
