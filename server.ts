import express, { type Request, type Response, type NextFunction } from 'express';
import { config } from './config';
import uploadsRouter from './routes/uploads';
import shippingRouter from './routes/shipping';

const app = express();

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

// uploads router handles its own multipart parsing (multer) — keep express.json()
// scoped to routes that actually take JSON bodies so it doesn't interfere.
app.use('/shipping', express.json(), shippingRouter);
app.use('/uploads', uploadsRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(config.port, () => {
  console.log(`Mass media upload API listening on :${config.port}`);
  console.log('Remember to run the worker process separately: npm run worker');
});
