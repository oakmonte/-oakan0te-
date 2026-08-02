import axios from 'axios';
import { config } from '../config';
import type {
  ShipbubbleAddressInput,
  ShipbubbleValidatedAddress,
  FetchRatesInput,
  FetchRatesResponseData,
  CreateShipmentInput,
  CreateShipmentResponseData,
  GetShipmentsResponseData,
  ShipbubbleEnvelope,
} from '../types/shipbubble';

const client = axios.create({
  baseURL: config.shipbubble.baseUrl,
  headers: {
    Authorization: `Bearer ${config.shipbubble.apiKey}`,
  },
  timeout: 30_000,
});

/**
 * Validates and registers an address, returning an address_code. Both the
 * sender and receiver address need to go through this once each before you
 * can request rates — ShipBubble's rates/shipment endpoints take
 * address_codes, not raw address strings. The first 50 validations per
 * account are free; after that ShipBubble charges per validation, so it's
 * worth caching address_codes for repeat senders (e.g. your warehouse) rather
 * than re-validating the same address on every order.
 */
export async function validateAddress(input: ShipbubbleAddressInput): Promise<ShipbubbleValidatedAddress> {
  const res = await client.post<ShipbubbleEnvelope<ShipbubbleValidatedAddress>>(
    '/shipping/address/validate',
    input
  );
  return res.data.data;
}

/**
 * Requests rates from all available couriers for a shipment. Returns a
 * request_token (valid 7 days) that must be passed to createShipment along
 * with the chosen courier's service_code/courier_id.
 */
export async function fetchRates(input: FetchRatesInput): Promise<FetchRatesResponseData> {
  const res = await client.post<ShipbubbleEnvelope<FetchRatesResponseData>>('/shipping/fetch_rates', input);
  return res.data.data;
}

/**
 * Books the shipment with the courier chosen from a prior fetchRates() call.
 * request_token ties this back to that specific rate request.
 */
export async function createShipment(input: CreateShipmentInput): Promise<CreateShipmentResponseData> {
  const res = await client.post<ShipbubbleEnvelope<CreateShipmentResponseData>>('/shipping/labels', input);
  return res.data.data;
}

/**
 * Lists shipment labels created on the account, paginated. ShipBubble's
 * tracking model is pull-based via this endpoint (each shipment carries its
 * own status/events/tracking_url) rather than a dedicated single-order GET —
 * filter results client-side by order_id if you need one specific shipment,
 * or page through for a dashboard view.
 */
export async function getShipments(page = 1): Promise<GetShipmentsResponseData> {
  const res = await client.get<ShipbubbleEnvelope<GetShipmentsResponseData>>('/shipping/labels', {
    params: { page },
  });
  return res.data.data;
}
