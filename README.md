# SMART Coaching Diagnostic

AI-powered founder self-assessment based on the SMART Model of Founder Coaching Functions (Hagedorn, 2025).

## What it does
A 3-minute conversational diagnostic that identifies which of the five SMART coaching functions a founder currently receives — and which are missing.

**Functions:** Structuring · Motivation · Access · Reflection · Transfer

## Deploy on Vercel (5 minutes)

### Step 1 – GitHub
1. Go to github.com and create a free account (if you don't have one)
2. Click "New repository" → name it `smart-diagnostic` → Create
3. Upload all files from this folder to the repository

### Step 2 – Vercel
1. Go to vercel.com and sign up with your GitHub account
2. Click "Add New Project" → Import your `smart-diagnostic` repository
3. Click "Deploy" — Vercel detects the settings automatically

### Step 3 – Add your API key
1. In Vercel, go to your project → Settings → Environment Variables
2. Add: `REACT_APP_ANTHROPIC_KEY` = your Anthropic API key
3. Redeploy

**Note:** The current version uses the Anthropic API directly from the browser (no backend needed). This is fine for demos and prototypes. For production, add a simple backend proxy to keep your API key secure.

## Local development
```bash
npm install
npm start
```

## Citation
Hagedorn, A. (2025). What Founder Coaches Actually Do: The SMART Model of Coaching Functions and Its Implications for Entrepreneurial Support.
