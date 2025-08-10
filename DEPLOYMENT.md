# 🚀 Deployment Guide - Typing Racer

## Quick Deploy to Make It Viral! 

### Option 1: Vercel + Railway (Recommended)
**Frontend (Vercel):**
1. Push to GitHub
2. Connect to Vercel
3. Set environment variables:
   - `VITE_SERVER_URL=https://your-railway-app.railway.app`
4. Deploy automatically

**Backend (Railway):**
1. Connect GitHub repo to Railway
2. Deploy from `server/` folder
3. Set PORT environment variable (Railway handles this)

### Option 2: Netlify + Heroku
**Frontend (Netlify):**
1. Build command: `cd client && npm run build`
2. Publish directory: `client/dist`
3. Environment variables in Netlify dashboard

**Backend (Heroku):**
1. Create Procfile: `web: node server/index.js`
2. Set Node.js buildpack
3. Deploy from Git

### Option 3: All-in-One (Render)
1. Connect GitHub repo
2. Create web service for backend
3. Create static site for frontend
4. Set environment variables

## Environment Variables Needed

**Client (.env):**
```
VITE_SERVER_URL=https://your-backend-domain.com
```

**Server:**
```
PORT=4000 (auto-set by most platforms)
NODE_ENV=production
```

## Pre-Launch Checklist ✅

- [ ] Update GitHub/Coffee links in footer
- [ ] Test on mobile devices
- [ ] Add Google Analytics (optional)
- [ ] Set up custom domain
- [ ] Add meta tags for social sharing
- [ ] Test multiplayer with friends

## Going Viral Strategy 🔥

1. **Share on social media** with challenge links
2. **Post in typing communities** (Reddit: r/MechanicalKeyboards, r/typing)
3. **Create TikTok/YouTube** content showing races
4. **Share in Discord servers** and gaming communities
5. **Post on Product Hunt** when ready
6. **Submit to typing websites** and directories

## Monetization Setup 💰

1. Create **Buy Me a Coffee** account
2. Set up **Ko-fi** or **Patreon** for recurring support
3. Consider **Google AdSense** for ads (non-intrusive)
4. Add **premium features** later (themes, stats, etc.)

## Analytics & Growth 📈

Add to `client/index.html`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## Social Media Meta Tags

Add to `client/index.html`:
```html
<meta property="og:title" content="Typing Racer - Multiplayer Typing Game">
<meta property="og:description" content="Race against friends in real-time typing challenges! Improve your WPM and accuracy.">
<meta property="og:image" content="/og-image.png">
<meta property="og:url" content="https://your-domain.com">
<meta name="twitter:card" content="summary_large_image">
```

## Performance Tips 🚄

- Enable gzip compression on server
- Add CDN for static assets
- Implement service worker for offline support
- Optimize images and fonts
- Monitor with tools like Lighthouse

Ready to go viral! 🚀
