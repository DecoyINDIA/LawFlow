const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export async function createOrder(
  period: 'monthly' | 'yearly',
  authToken: string,
): Promise<{ orderId: string; amount: number; keyId: string }> {
  const res = await fetch(`${BASE_URL}/api/payments/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ period }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create order' }));
    throw new Error(err.detail || 'Failed to create order');
  }
  return res.json();
}

export async function verifyPayment(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  period: string;
  authToken: string;
}): Promise<{ success: boolean; plan: string; planExpiry: string }> {
  const { authToken, ...body } = params;
  const res = await fetch(`${BASE_URL}/api/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Verification failed' }));
    throw new Error(err.detail || 'Verification failed');
  }
  return res.json();
}

export function buildPaymentUrl(params: {
  keyId: string;
  orderId: string;
  amount: number;
  advocateName: string;
  phone: string;
  callbackUrl: string;
}): string {
  const { keyId, orderId, amount, advocateName, phone, callbackUrl } = params;
  const base = 'https://api.razorpay.com/v1/checkout/embedded';
  const qs = new URLSearchParams({
    key_id: keyId,
    order_id: orderId,
    amount: String(amount),
    name: 'LawFlow',
    description: 'Pro Subscription',
    'prefill.name': advocateName,
    'prefill.contact': phone,
    callback_url: callbackUrl,
    cancel_url: callbackUrl,
  });
  return `${base}?${qs.toString()}`;
}
