import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/who-knows-you-best/', // set '/<repo>/' if deploying under subpath
})
