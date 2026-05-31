import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import profileRoutes from './routes/profile.js';
import handlesRoutes from './routes/handles.js';
import problemsRoutes from './routes/problems.js';
import notesRoutes from './routes/notes.js';
import revisionRoutes from './routes/revision.js';
import contestsRoutes from './routes/contests.js';
import upsolveRoutes from './routes/upsolve.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/handles', handlesRoutes);
app.use('/api/problems', problemsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/revision', revisionRoutes);
app.use('/api/contests', contestsRoutes);
app.use('/api/upsolve', upsolveRoutes);
app.use('/api/admin', adminRoutes);

if (config.serveFrontend) {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) next();
    });
  });
}

app.listen(config.port, () => {
  console.log(`CP Vault API running on http://localhost:${config.port}`);
});
