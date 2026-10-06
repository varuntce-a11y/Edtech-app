'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, GraduationCap, ShieldCheck } from 'lucide-react';
import { formatRupees } from '@/lib/api';

type PaymentConfirmation = {
  orderId: string;
  totalPaise: number;
  paymentMethod: string;
  courseTitles: string[];
};

export function OrderConfirmation() {
  const [orderId, setOrderId] = useState('');
  const [confirmation, setConfirmation] = useState<PaymentConfirmation | null>(null);

  useEffect(() => {
    const requestedOrderId = new URLSearchParams(window.location.search).get('orderId') ?? '';
    setOrderId(requestedOrderId);
    try {
      const stored = sessionStorage.getItem('upskillin-order-confirmation');
      if (!stored) return;
      const parsed = JSON.parse(stored) as PaymentConfirmation;
      if (parsed.orderId === requestedOrderId) setConfirmation(parsed);
    } catch {
      setConfirmation(null);
    }
  }, []);

  return <main className="subpage">
    <header className="sub-nav"><Link href="/" className="brand"><span className="brand-icon"><GraduationCap size={20} /></span><span>upskill<span className="brand-in">in</span></span></Link><span className="secure-label"><ShieldCheck size={14} /> Order confirmation</span></header>
    <section className="payment-success order-confirmation">
      <CheckCircle2 size={44} />
      <span className="eyebrow">PAYMENT CONFIRMED</span>
      <h1>Your order is confirmed.</h1>
      <p>Your payment was verified and your course enrolment is ready.</p>
      {confirmation ? <div className="confirmation-card">
        <div><span>Order reference</span><strong>{confirmation.orderId}</strong></div>
        <div><span>Amount paid</span><strong>{formatRupees(confirmation.totalPaise)}</strong></div>
        <div><span>Payment method</span><strong>{confirmation.paymentMethod.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</strong></div>
        <div className="confirmation-courses"><span>Courses</span>{confirmation.courseTitles.map((title) => <strong key={title}>{title}</strong>)}</div>
      </div> : orderId ? <p className="confirmation-reference">Order reference: <strong>{orderId}</strong></p> : null}
      <Link href="/my-courses" className="solid-link">Go to My Courses <ArrowRight size={15} /></Link>
      <Link href="/" className="confirmation-home">Continue exploring courses</Link>
    </section>
  </main>;
}
