const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const dbURI = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/health-portal';

mongoose.connect(dbURI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`API docs: http://localhost:${PORT}/api/docs`);
    });
  })
  .catch((error) => {
    console.error('Database connection error:', error.message);
    process.exit(1);
  });
