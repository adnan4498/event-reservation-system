const net = require('net');

const client = net.createConnection({
  host: 'invention-eager-congenial-18797.db.redis.io',
  port: 14458
}, () => {
  console.log('Connected to Cloud Redis! Sending commands...');
  // 1. Authenticate with password
  client.write('AUTH default XA4stHdZl56e9aG8RrIVkz3T3LCjj7nb\r\n');
  // 2. Wipe the database
  client.write('FLUSHDB\r\n');
});

client.on('data', (data) => {
  console.log('Server Response:', data.toString().trim());
  client.end();
});

client.on('end', () => {
  console.log('Disconnected. Your limits should be clear.');
  process.exit(0);
});

client.on('error', (err) => {
  console.error('Connection failed:', err.message);
});
