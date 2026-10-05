'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, GraduationCap, ShieldCheck } from 'lucide-react';
import { API_URL, Course, formatRupees } from '@/lib/api';
import { GST_FACTOR } from './cart';

type CartCourse = Course & { batchId?: string };
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  prefill: { name: string };
  theme: { color: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export function Checkout() {
  const [items, setItems] = useState<CartCourse[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [coupon, setCoupon] = useState('');
  const [includeGstin, setIncludeGstin] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);

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
        body: JSON.stringify({ billingName: name, billingAddress: address, gstin: includeGstin ? gstin : undefined, couponCode: coupon || undefined }),
      });
      const order = await orderResponse.json() as { id?: string; message?: string; totalPaise?: number };
      if (!orderResponse.ok || !order.id) throw new Error(order.message ?? 'We could not create your order. Your cart has been kept.');
      const paymentResponse = await fetch(`${API_URL}/payments/${order.id}/checkout`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const payment = await paymentResponse.json() as { provider?: string; orderId?: string; keyId?: string; amount?: number; message?: string };
      if (!paymentResponse.ok || !payment.orderId || !payment.amount) throw new Error(payment.message ?? 'Order created, but payment could not start. Contact support with order ID ' + order.id);
      if (payment.provider === 'simulated') {
        const simulation = await fetch(`${API_URL}/payments/${order.id}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ success: true }),
        });
        const simulated = await simulation.json() as { received?: boolean; message?: string };
        if (!simulation.ok || !simulated.received) throw new Error(simulated.message ?? 'The local payment simulation failed.');
        localStorage.removeItem('upskillin-cart');
        localStorage.removeItem('upskillin-pending-order-key');
        setPaid(true);
        setStatus('Local test payment verified by the API. Your enrolment is ready.');
        return;
      }
      if (!payment.keyId) throw new Error('The payment provider did not return its public test key.');
      if (!window.Razorpay) throw new Error('Payment checkout is still loading. Please wait a moment and try again.');
      const checkout = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: 'INR',
        name: 'UpSkillIN',
        description: 'Course enrolment',
        order_id: payment.orderId,
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
            localStorage.removeItem('upskillin-cart');
            localStorage.removeItem('upskillin-pending-order-key');
            setPaid(true);
            setStatus('Payment verified. Your enrolment is ready.');
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

  return <main className="subpage"><script src="https://checkout.razorpay.com/v1/checkout.js" async /><header className="sub-nav"><Link href="/" className="brand"><span className="brand-icon"><GraduationCap size={20} /></span><span>upskill<span className="brand-in">in</span></span></Link><span className="secure-label"><ShieldCheck size={14} /> Secure checkout</span></header>
    {paid ? <section className="payment-success"><CheckCircle2 size={40} /><span className="eyebrow">YOU DID IT</span><h1>One step closer.</h1><p>{status}</p><Link href="/my-courses" className="solid-link">Go to My Courses <ArrowRight size={15} /></Link></section> :
      <section className="checkout-page"><Link href="/cart" className="back-link"><ArrowLeft size={14} /> Back to cart</Link><div className="checkout-heading"><span className="eyebrow">ALMOST THERE</span><h1>Let’s make it yours.</h1><p>Your next chapter is one small step away.</p></div><form className="checkout-layout" onSubmit={pay}>
        <div className="billing-card"><h2>Billing details</h2><p>Used for your GST invoice.</p><label>Full name<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Name on your invoice" /></label><label>Billing address<textarea required minLength={8} maxLength={300} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, state, PIN code" rows={3} /></label><label className="consent-check"><input type="checkbox" checked={includeGstin} onChange={(event) => setIncludeGstin(event.target.checked)} /><span>I need a business GST invoice</span></label>{includeGstin && <label>GSTIN<input required pattern="[0-9A-Z]{15}" maxLength={15} value={gstin} onChange={(event) => setGstin(event.target.value.toUpperCase())} placeholder="15-character GSTIN" /></label>}<label>Coupon code<input value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="Enter a coupon (optional)" /></label>
          <label className="consent-check terms-check"><input type="checkbox" required /><span>I agree to the <Link href="/refund-policy">refund policy</Link> and understand my course access begins after payment confirmation.</span></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={busy || !items.length}>{busy ? 'Preparing secure payment…' : `Pay ${formatRupees(subtotal)} securely`} <ArrowRight size={16} /></button>
          <small className="checkout-assurance"><ShieldCheck size={13} /> Payment confirmed only after server-side signature verification.</small>
        </div>
        <aside className="cart-summary checkout-summary"><h2>Your courses</h2>{items.map((item) => <div className="summary-course" key={item.id}><span>{item.title}</span><strong>{formatRupees(item.pricePaise)}</strong></div>)}<div><span>Course fee</span><span>{formatRupees(subtotal - tax)}</span></div><div><span>GST (included)</span><span>{formatRupees(tax)}</span></div><div className="cart-total"><strong>Total incl. GST</strong><strong>{formatRupees(subtotal)}</strong></div><p><ShieldCheck size={14} /> Enrolment follows verified payment.</p></aside>
      </form></section>}
  </main>;
}
