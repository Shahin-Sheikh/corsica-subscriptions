const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Initiate OAuth -- Shopify redirects here on install
router.get('/', (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Missing shop parameter');

  const authUrl = `https://${shop}/admin/oauth/authorize`
    + `?client_id=${process.env.SHOPIFY_API_KEY}`
    + `&scope=${process.env.SHOPIFY_SCOPES}`
    + `&redirect_uri=${process.env.APP_URL}/auth/callback`;

  res.redirect(authUrl);
});

// Handle callback -- exchange code for access token
router.get('/callback', async (req, res) => {
  const { shop, code, hmac } = req.query;

  // Validate HMAC
  const params = Object.keys(req.query)
    .filter((k) => k !== 'hmac')
    .sort()
    .map((k) => `${k}=${req.query[k]}`)
    .join('&');

  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(params)
    .digest('hex');

  if (hash !== hmac) {
    return res.status(400).send('HMAC validation failed');
  }

  try {
    // Exchange code for permanent access token
    const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    });

    const accessToken = response.data.access_token;

    // Store in database (upsert)
    await pool.query(
      `INSERT INTO shops (shop_domain, access_token) VALUES ($1, $2)
       ON CONFLICT (shop_domain) DO UPDATE SET access_token = $2`,
      [shop, accessToken],
    );

    console.log(`App installed successfully for ${shop}`);
    res.send('App installed successfully. You can close this window.');
  } catch (err) {
    console.error('OAuth error:', err.message);
    res.status(500).send('OAuth failed');
  }
});

module.exports = router;
