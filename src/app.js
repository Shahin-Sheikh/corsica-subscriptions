require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// Health check
app.get('/', (req, res) => res.json({ status: 'Corsica Subscriptions running' }));

// OAuth routes
app.use('/auth', require('./routes/auth'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Corsica Subscriptions running on port ${PORT}`));
