export interface ShipbubbleAddressInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface ShipbubbleValidatedAddress {
  address_code: number;
  name: string;
  email: string;
  phone?: string;
  street_no?: string;
  street?: string;
  formatted_address: string;
  country: string;
  country_code: string;
  city: string;
  city_code?: string;
  state: string;
  state_code?: string;
  postal_code: string;
  latitude: number;
  longitude: number;
}

export interface ShipbubblePackageItem {
  name: string;
  description: string;
  unit_weight: string;
  unit_amount: string;
  quantity: string;
}

export interface ShipbubblePackageDimension {
  length: number;
  width: number;
  height: number;
}

export interface FetchRatesInput {
  sender_address_code: number;
  reciever_address_code: number; // sic — matches ShipBubble's actual field name
  pickup_date: string; // yyyy-mm-dd
  category_id: number;
  package_items: ShipbubblePackageItem[];
  package_dimension: ShipbubblePackageDimension;
  service_type?: 'pickup' | 'dropoff';
  delivery_instructions?: string;
}

export interface ShipbubbleCourierRate {
  courier_id: string | number;
  courier_name: string;
  service_code: string;
  service_type: 'pickup' | 'dropoff';
  currency: string;
  total: number;
  rate_card_amount: number;
  pickup_eta: string;
  delivery_eta: string;
  is_cod_available: boolean;
  tracking_level: number;
  [key: string]: unknown; // ShipBubble returns several more fields per courier; kept open-ended
}

export interface FetchRatesResponseData {
  request_token: string;
  couriers: ShipbubbleCourierRate[];
  fastest_courier: ShipbubbleCourierRate;
  cheapest_courier: ShipbubbleCourierRate;
  checkout_data: Record<string, unknown>;
}

export interface CreateShipmentInput {
  request_token: string;
  service_code: string;
  courier_id: string | number;
  insurance_code?: string;
  is_cod_label?: boolean;
}

export interface ShipbubbleShipmentParty {
  name: string;
  phone: string;
  email: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface CreateShipmentResponseData {
  order_id: string;
  status: string;
  courier: { name: string; email: string; phone: string };
  ship_from: ShipbubbleShipmentParty;
  ship_to: ShipbubbleShipmentParty;
  payment: { shipping_fee: number; type: string; status: string; currency: string };
  items: Array<{ name: string; description: string; weight: number; amount: string; quantity: string; total: number }>;
  tracking_url: string;
  date: string;
}

export type ShipmentStatus = 'pending' | 'confirmed' | 'picked_up' | 'in_transit' | 'completed' | 'cancelled';

export interface ShipbubbleShipmentRecord {
  order_id: string;
  status: ShipmentStatus;
  courier: {
    name: string;
    email: string;
    phone: string;
    tracking_code?: string;
    tracking_message?: string | null;
  };
  ship_from: ShipbubbleShipmentParty;
  ship_to: ShipbubbleShipmentParty;
  package_status: Array<{ status: string; datetime: string }>;
  waybill_document: string | null;
  events: Array<{ location: string; message: string; captured: string }>;
  tracking_url: string;
  date: string;
}

export interface GetShipmentsResponseData {
  results: ShipbubbleShipmentRecord[];
  pagination: { current: number; perPage: number; previous: number; next: number; total: number };
}

export interface ShipbubbleEnvelope<T> {
  status: 'success' | 'error';
  message: string;
  data: T;
}
