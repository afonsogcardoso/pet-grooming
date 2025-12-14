import app from './src/app.js'

// Vercel's Node runtime accepts an Express app directly as the default export.
// This avoids the extra lambda adapter and keeps the response cycle simple.
export default app
