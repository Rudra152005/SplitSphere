import express from 'express';
import { createServerAdapter } from '@whatwg-node/server';
import appHandler from './dist/server/server.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Serve static assets from dist/client
app.use(express.static(path.join(__dirname, 'dist', 'client')));

// Pass all other requests to TanStack Start's SSR handler
const adapter = createServerAdapter(appHandler.default || appHandler);
app.use(adapter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
