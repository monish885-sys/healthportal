#!/bin/bash

# Export local MongoDB data for Render deployment
echo "🔄 Exporting local MongoDB data..."

# Create backup directory
mkdir -p ./mongodb-backup

# Export all collections from health-portal database
mongodump --db=health-portal --out=./mongodb-backup

echo "✅ MongoDB data exported to ./mongodb-backup/"
echo "📁 Collections exported:"
ls -la ./mongodb-backup/health-portal/

echo ""
echo "🚀 Next steps for Render deployment:"
echo "1. Push this code to GitHub"
echo "2. Connect GitHub repo to Render"
echo "3. Create MongoDB database on Render"
echo "4. Import this backup using: mongorestore --host=<render-host> --port=27017 --db=health-portal ./mongodb-backup/health-portal"
