# 🚀 Health Portal - Render Deployment Guide

## 📋 Prerequisites
- GitHub account
- Render account (free tier available)
- Your local MongoDB data exported (✅ Already done!)

## 🔧 Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click "New repository" (green button)
3. Repository name: `health-portal-api`
4. Description: `AI-Powered Health Portal with ML Symptom Analysis`
5. Set to **Public** (required for free Render deployment)
6. **DO NOT** initialize with README, .gitignore, or license
7. Click "Create repository"

## 🔗 Step 2: Connect Local Repository to GitHub

Run these commands in your terminal:

```bash
# Add the new GitHub repository as origin
git remote add origin https://github.com/YOUR_USERNAME/health-portal-api.git

# Push your code to GitHub
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## 🌐 Step 3: Deploy on Render

### 3.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Verify your email

### 3.2 Deploy Web Service
1. In Render Dashboard, click **"New +"**
2. Select **"Web Service"**
3. Connect your GitHub repository: `health-portal-api`
4. Configure the service:
   - **Name**: `health-portal-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

### 3.3 Set Environment Variables
In the Render service settings, add these environment variables:

```
NODE_ENV=production
SESSION_SECRET=your-super-secret-session-key-here
MONGODB_URI=will-be-set-after-database-creation
```

### 3.4 Create MongoDB Database
1. In Render Dashboard, click **"New +"**
2. Select **"PostgreSQL"** (Render doesn't have MongoDB, we'll use MongoDB Atlas)
3. Or better: Use **MongoDB Atlas** (free tier available)

## 🗄️ Step 4: Set Up MongoDB Atlas (Recommended)

### 4.1 Create MongoDB Atlas Account
1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Sign up for free
3. Create a new cluster (free tier: M0)
4. Create a database user
5. Whitelist all IP addresses (0.0.0.0/0) for Render access

### 4.2 Get Connection String
1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Copy the connection string
4. Replace `<password>` with your database user password
5. Replace `<dbname>` with `health-portal`

### 4.3 Update Render Environment Variables
Update the `MONGODB_URI` in Render with your Atlas connection string.

## 📊 Step 5: Import Your Data

### 5.1 Install MongoDB Tools
```bash
# On macOS with Homebrew
brew install mongodb/brew/mongodb-database-tools

# Or download from: https://www.mongodb.com/try/download/database-tools
```

### 5.2 Import Data to Atlas
```bash
# Import your exported data
mongorestore --uri="mongodb+srv://username:password@cluster.mongodb.net/health-portal" ./mongodb-backup/health-portal
```

Replace the connection string with your actual Atlas connection string.

## 🎯 Step 6: Deploy and Test

1. **Deploy**: Click "Deploy" in Render
2. **Wait**: Deployment takes 2-5 minutes
3. **Test**: Visit your Render URL (e.g., `https://health-portal-api.onrender.com`)

## 🔐 Step 7: Access Your Application

Your deployed application will be available at:
- **Main Portal**: `https://your-app-name.onrender.com`
- **Admin Portal**: `https://your-app-name.onrender.com/admin`
- **Doctor Portal**: `https://your-app-name.onrender.com/doctor`
- **Patient Portal**: `https://your-app-name.onrender.com/patient`

## 📝 Default Login Credentials

After importing your data, use these credentials:
- **Admin**: `admin@healthportal.com` / `admin123`
- **Doctor**: `doctor@healthportal.com` / `admin123`
- **Patient**: `patient@healthportal.com` / `admin123`

## 🚨 Troubleshooting

### Common Issues:
1. **Build Fails**: Check Node.js version compatibility
2. **Database Connection**: Verify MongoDB Atlas connection string
3. **Environment Variables**: Ensure all required variables are set
4. **File Uploads**: Render free tier has limitations on file storage

### Render Free Tier Limitations:
- Service sleeps after 15 minutes of inactivity
- Cold starts take 30-60 seconds
- Limited to 750 hours/month
- No persistent file storage

## 🎉 Success!

Once deployed, your Health Portal will be globally accessible with:
- ✅ AI-powered symptom analysis
- ✅ Disease tracking and outbreak detection
- ✅ File upload and management
- ✅ Appointment booking
- ✅ Feedback system
- ✅ Multi-role access (Admin, Doctor, Patient)

## 📞 Support

If you encounter issues:
1. Check Render deployment logs
2. Verify MongoDB Atlas connection
3. Test locally first
4. Check environment variables

---

**Ready to deploy? Follow these steps and your Health Portal will be live globally! 🌍**
