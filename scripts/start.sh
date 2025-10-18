#!/bin/bash

echo "🏥 Starting Health Portal - Syndromic Surveillance System"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    echo "❌ Error: Please run this script from the health-portal root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected: ~/Desktop/health-portal"
    exit 1
fi

# Navigate to backend directory
cd backend

echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "🗄️  Starting MongoDB..."
brew services start mongodb-community

# Wait a moment for MongoDB to start
sleep 3

echo "🌱 Seeding database with sample data..."
npm run seed

if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Database seeding failed, but continuing..."
fi

echo "🚀 Starting Health Portal API server..."
echo "   Backend: http://localhost:3000"
echo "   Frontend: http://localhost:3000"
echo "   Test Login: http://localhost:3000/test-login.html"
echo ""
echo "📋 Default Login Credentials:"
echo "   Email: john.doe@example.com"
echo "   Password: SecurePass123!"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Start the server
npm start
