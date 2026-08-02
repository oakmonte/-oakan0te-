import express, { type Request, type Response } from 'express';
import * as shipbubble from '../adapters/shipbubbleAdapter';
import type { FetchRatesInput, CreateShipmentInput, ShipbubbleAddressInput } from '../types/shipbubble';

const router = express.Router();

function handleError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  res.status(502).json({ error: 'ShipBubble request failed.', detail: message });
}

// POST /shipping/addresses/validate
// Body: { name, email, phone, address, latitude?, longitude? }
// Returns an address_code — call this once for sender (e.g. your warehouse,
// can be cached) and once for the receiver before requesting rates.
router.post('/addresses/validate', async (req: Request, res: Response) => {
  try {
    const input = req.body as ShipbubbleAddressInput;
    const address = await shipbubble.validateAddress(input);
    res.json(address);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /shipping/rates
// Body matches FetchRatesInput: sender_address_code, reciever_address_code,
// pickup_date (yyyy-mm-dd), category_id, package_items[], package_dimension.
// Returns available courier rates + a request_token to pass to /shipments.
router.post('/rates', async (req: Request, res: Response) => {
  try {
    const input = req.body as FetchRatesInput;
    const rates = await shipbubble.fetchRates(input);
    res.json(rates);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /shipping/shipments
// Body: { request_token, service_code, courier_id, insurance_code?, is_cod_label? }
// Books the shipment with the courier the caller selected from /rates.
router.post('/shipments', async (req: Request, res: Response) => {
  try {
    const input = req.body as CreateShipmentInput;
    const shipment = await shipbubble.createShipment(input);
    res.status(201).json(shipment);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /shipping/shipments?page=1
// Paginated list of all shipments with current status/events — use for a
// tracking dashboard, or filter the results by order_id client-side for a
// single-shipment tracking view.
router.get('/shipments', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const shipments = await shipbubble.getShipments(page);
    res.json(shipments);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /shipping/shipments/:orderId
// Convenience endpoint: pages through the list to find one order_id.
// Fine for occasional lookups; for a high-traffic tracking page, poll the
// paginated list endpoint above and cache client-side instead.
router.get('/shipments/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const MAX_PAGES = 50; // hard cap so a bad response shape can't spin forever
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { results } = await shipbubble.getShipments(page);
      if (!results.length) break;
      const match = results.find((s) => s.order_id === orderId);
      if (match) return res.json(match);
    }
    res.status(404).json({ error: `Shipment ${orderId} not found.` });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
