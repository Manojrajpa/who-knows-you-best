# Who Knows You Best — FINAL (Push & Play)

Your stable project, prepped for **GitHub Pages** with **Supabase** baked in.
- Vite `base: '/who-knows-you-best/'`
- Paths fixed (assets & index.html)
- `.nojekyll` + `404.html`
- GitHub Actions workflow builds & deploys `dist/`
- `public/config.json` contains your Supabase URL & anon key

## Deploy
```bash
git init
git remote add origin https://github.com/Manojrajpa/who-knows-you-best.git
git checkout -b main
npm install
npm run build
git add .
git commit -m "final: push-and-play"
git push -u origin main
```
Then: Settings → Pages → Source: GitHub Actions.
URL: https://manojrajpa.github.io/who-knows-you-best/