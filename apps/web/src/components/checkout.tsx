'use client';

import Link from 'next/link';
import { FormEvent, MouseEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CreditCard, GraduationCap, Landmark, ShieldCheck, Smartphone } from 'lucide-react';
import { API_URL, Course, formatRupees } from '@/lib/api';
import { GST_FACTOR } from './cart';

type CartCourse = Course & { batchId?: string };
type PaymentMethod = 'credit_card' | 'debit_card' | 'netbanking' | 'upi';
type PaymentConfirmation = {
  orderId: string;
  totalPaise: number;
  paymentMethod: PaymentMethod;
  courseTitles: string[];
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  method: { card: boolean; netbanking: boolean; upi: boolean };
  config: {
    display: {
      blocks: { name: string; instruments: { method: string }[] }[];
      sequence: string[];
      preferences: { show_default_blocks: boolean };
    };
  };
  handler: (result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  prefill: { name: string };
  theme: { color: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

const paymentMethods: { id: PaymentMethod; label: string; description: string; icon: typeof CreditCard }[] = [
  { id: 'credit_card', label: 'Credit Card', description: 'Visa, Mastercard and more', icon: CreditCard },
  { id: 'debit_card', label: 'Debit Card', description: 'Pay directly from your bank', icon: CreditCard },
  { id: 'netbanking', label: 'Net Banking', description: 'All major Indian banks', icon: Landmark },
  { id: 'upi', label: 'UPI', description: 'Pay with any UPI app', icon: Smartphone },
];

export function Checkout() {
  const router = useRouter();
  const [items, setItems] = useState<CartCourse[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [sameAddress, setSameAddress] = useState(true);
  const [gstin, setGstin] = useState('');
  const [coupon, setCoupon] = useState('');
  const [includeGstin, setIncludeGstin] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card');
  const [step, setStep] = useState<'address' | 'payment'>('address');
  const [error, setError] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem('upskillin-cart') ?? '[]') as CartCourse[]);
      setIdempotencyKey(localStorage.getItem('upskillin-pending-order-key') ?? '');
      const user = JSON.parse(localStorage.getItem('upskillin-user') ?? 'null') as { name?: string } | null;
      if (user?.name) setName(user.name);
    } catch {
      setError('We could not read your saved cart. Please return to your cart and try again.');
    }
  }, []);

  const subtotal = items.reduce((total, item) => total + item.pricePaise, 0);
  const tax = Math.round(subtotal * 18 / GST_FACTOR);

  function continueToPayment(event: FormEvent) {
    event.preventDefault();
    setError('');
    setStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function confirmOrder(orderId: string, totalPaise: number) {
    const confirmation: PaymentConfirmation = {
      orderId,
      totalPaise,
      paymentMethod,
      courseTitles: items.map(({ title }) => title),
    };
    try {
      sessionStorage.setItem('upskillin-order-confirmation', JSON.stringify(confirmation));
    } catch {
      // The order ID remains in the URL as a minimal confirmation fallback.
    }
    localStorage.removeItem('upskillin-cart');
    localStorage.removeItem('upskillin-pending-order-key');
    router.push(`/order-confirmation?orderId=${encodeURIComponent(orderId)}`);
  }

  async function pay(event: FormEvent) {
    event.preventDefault();
    setError('');
    const token = localStorage.getItem('upskillin-access-token');
    if (!token) {
      window.location.href = `/login?redirect=${encodeURIComponent('/checkout')}`;
      return;
    }
    if (items.length === 0) {
      setError('Your cart is empty. Add a course before checking out.');
      return;
    }
    if (items.some((item) => item.mode !== 'SELF_PACED' && !item.batchId)) {
      setError('Choose a batch for every instructor-led course before checkout.');
      return;
    }

    setBusy(true);
    try {
      const currentKey = idempotencyKey || crypto.randomUUID();
      localStorage.setItem('upskillin-pending-order-key', currentKey);
      setIdempotencyKey(currentKey);
      const orderResponse = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': currentKey },
        body: JSON.stringify({
          billingName: name,
          billingAddress: address,
          deliveryAddress: sameAddress ? address : deliveryAddress,
          gstin: includeGstin ? gstin : undefined,
          couponCode: coupon || undefined,
        }),
      });
      const order = await orderResponse.json() as { id?: string; message?: string; totalPaise?: number };
      const orderId = order.id;
      if (!orderResponse.ok || !orderId) throw new Error(order.message ?? 'We could not create your order. Your cart has been kept.');

      const paymentResponse = await fetch(`${API_URL}/payments/${orderId}/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payment = await paymentResponse.json() as { provider?: string; orderId?: string; keyId?: string; amount?: number; message?: string };
      if (!paymentResponse.ok || !payment.orderId || !payment.amount) {
        throw new Error(payment.message ?? `Order created, but payment could not start. Contact support with order ID ${order.id}`);
      }

      if (payment.provider === 'simulated') {
        const simulation = await fetch(`${API_URL}/payments/${order.id}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ success: true }),
        });
        const simulated = await simulation.json() as { received?: boolean; message?: string };
        if (!simulation.ok || !simulated.received) throw new Error(simulated.message ?? 'The local payment simulation failed.');
        confirmOrder(orderId, order.totalPaise ?? payment.amount);
        return;
      }

      if (!payment.keyId) throw new Error('The payment provider did not return its public test key.');
      if (!window.Razorpay) throw new Error('Payment checkout is still loading. Please wait a moment and try again.');
      const method = paymentMethod === 'netbanking' ? 'netbanking' : paymentMethod === 'upi' ? 'upi' : 'card';
      const blockName = `preferred_${method}`;
      const checkout = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: 'INR',
        name: 'UpSkillIN',
        description: 'Course enrolment',
        order_id: payment.orderId,
        method: { card: method === 'card', netbanking: method === 'netbanking', upi: method === 'upi' },
        config: {
          display: {
            blocks: [{ name: blockName, instruments: [{ method }] }],
            sequence: [blockName],
            preferences: { show_default_blocks: false },
          },
        },
        prefill: { name },
        theme: { color: '#176b57' },
        handler: async (result) => {
          try {
            const verify = await fetch(`${API_URL}/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(result),
            });
            const verified = await verify.json() as { received?: boolean; message?: string };
            if (!verify.ok || !verified.received) throw new Error(verified.message ?? 'Payment is still being confirmed.');
            confirmOrder(orderId, order.totalPaise ?? payment.amount!);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Payment verification failed. Your payment is not considered complete.');
          }
        },
      });
      checkout.open();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const selectedMethod = paymentMethods.find(({ id }) => id === paymentMethod)!;

  return <main className="subpage">
    <script src="https://checkout.razorpay.com/v1/checkout.js" async />
    <header className="sub-nav"><Link href="/" className="brand"><span className="brand-icon"><GraduationCap size={20} /></span><span>upskill<span className="brand-in">in</span></span></Link><span className="secure-label"><ShieldCheck size={14} /> Secure checkout</span></header>
    <section className="checkout-page">
      <Link href={step === 'payment' ? '#' : '/cart'} className="back-link" onClick={(event: MouseEvent<HTMLAnchorElement>) => { if (step === 'payment') { event.preventDefault(); setStep('address'); setError(''); } }}><ArrowLeft size={14} /> {step === 'payment' ? 'Back to details' : 'Back to cart'}</Link>
      <div className="checkout-heading"><span className="eyebrow">{step === 'address' ? 'STEP 1 OF 2 · YOUR DETAILS' : 'STEP 2 OF 2 · PAYMENT'}</span><h1>{step === 'address' ? 'Let’s make it yours.' : 'Choose how to pay.'}</h1><p>{step === 'address' ? 'Add your billing and delivery details to continue.' : 'Select a secure payment method for your order.'}</p></div>
      <div className="checkout-layout">
        {step === 'address' ? <form className="billing-card" onSubmit={continueToPayment}>
          <h2>Billing details</h2><p>Used for your GST invoice.</p>
          <label>Full name<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Name on your invoice" /></label>
          <label>Billing address<textarea required minLength={8} maxLength={300} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, state, PIN code" rows={3} /></label>
          <div className="address-section"><h2>Delivery details</h2><p>Where your course materials or enrolment details should be delivered.</p>
            <label className="consent-check"><input type="checkbox" checked={sameAddress} onChange={(event) => setSameAddress(event.target.checked)} /><span>Use billing address as delivery address</span></label>
            {!sameAddress && <label>Delivery address<textarea required minLength={8} maxLength={300} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Street, city, state, PIN code" rows={3} /> </label>}
          </div>
          <label className="consent-check"><input type="checkbox" checked={includeGstin} onChange={(event) => setIncludeGstin(event.target.checked)} /><span>I need a business GST invoice</span></label>
          {includeGstin && <label>GSTIN<input required pattern="[0-9A-Z]{15}" maxLength={15} value={gstin} onChange={(event) => setGstin(event.target.value.toUpperCase())} placeholder="15-character GSTIN" /></label>}
          <label>Coupon code<input value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="Enter a coupon (optional)" /></label>
          <label className="consent-check terms-check"><input type="checkbox" required /><span>I agree to the <Link href="/refund-policy">refund policy</Link> and understand my course access begins after payment confirmation.</span></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={busy || !items.length}>Continue to payment <ArrowRight size={16} /></button>
        </form> : <form className="billing-card" onSubmit={pay}>
          <h2>Payment method</h2><p>Choose your preferred way to pay securely.</p>
          <div className="payment-methods" role="radiogroup" aria-label="Payment method">
            {paymentMethods.map(({ id, label, description, icon: Icon }) => <label className={`payment-method${paymentMethod === id ? ' payment-method-selected' : ''}`} key={id}>
              <input type="radio" name="paymentMethod" value={id} checked={paymentMethod === id} onChange={() => setPaymentMethod(id)} />
              <Icon size={19} aria-hidden="true" />
              <span><strong>{label}</strong><small>{description}</small></span>
            </label>)}
          </div>
          <div className="checkout-address-review"><h3>Delivery &amp; billing</h3><p><strong>{name}</strong><br />{sameAddress ? address : deliveryAddress}<br /><span>Billing: {address}</span></p></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={busy || !items.length}>{busy ? 'Preparing secure payment…' : `Pay ${formatRupees(subtotal)} securely`} <ArrowRight size={16} /></button>
          <small className="checkout-assurance"><ShieldCheck size={13} /> Payment confirmed only after server-side signature verification.</small>
        </form>}
        <aside className="cart-summary checkout-summary"><h2>Your courses</h2>{items.map((item) => <div className="summary-course" key={item.id}><span>{item.title}</span><strong>{formatRupees(item.pricePaise)}</strong></div>)}<div><span>Course fee</span><span>{formatRupees(subtotal - tax)}</span></div><div><span>GST (included)</span><span>{formatRupees(tax)}</span></div><div className="cart-total"><strong>Total incl. GST</strong><strong>{formatRupees(subtotal)}</strong></div>{step === 'payment' && <div className="selected-payment"><span>Paying with</span><strong>{selectedMethod.label}</strong></div>}<p><ShieldCheck size={14} /> Enrolment follows verified payment.</p></aside>
      </div>
    </section>
  </main>;
}
