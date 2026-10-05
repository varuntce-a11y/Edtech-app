'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, MapPin, Minus, ShieldCheck, ShoppingBag, Trash2 } from 'lucide-react';
import { API_URL, Course, formatRupees, modeNames } from '@/lib/api';

type CartCourse = Course & { batchId?: string };
export const GST_FACTOR = 118;

export function Cart() {
  const [items, setItems] = useState<CartCourse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cartError, setCartError] = useState('');
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('upskillin-cart') ?? '[]') as CartCourse[];
      setItems(stored);
      const token = localStorage.getItem('upskillin-access-token');
      if (token && stored.length) {
        void Promise.all(stored.map((item) => fetch(`${API_URL}/cart/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ courseId: item.id, batchId: item.batchId }),
        }))).then((responses) => {
          if (responses.some((response) => !response.ok)) setCartError('One or more courses could not sync to your account. Sign in again or review the selected batch.');
        }).catch(() => setCartError('Your saved cart could not sync to your account. Please try again.'));
      }
    } catch {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  function update(next: CartCourse[]) {
    setItems(next);
    localStorage.setItem('upskillin-cart', JSON.stringify(next));
  }

  const subtotal = items.reduce((total, item) => total + item.pricePaise, 0);
  const tax = Math.round(subtotal * 18 / GST_FACTOR);
  return <main className="subpage"><header className="sub-nav"><Link href="/" className="brand"><span className="brand-icon"><GraduationCap size={20} /></span><span>upskill<span className="brand-in">in</span></span></Link><Link href="/">Keep exploring <ArrowRight size={14} /></Link></header>
    <section className="cart-page"><Link href="/" className="back-link"><ArrowLeft size={14} /> Continue browsing</Link><div className="cart-heading"><div><span className="eyebrow">YOUR NEXT STEP</span><h1>Your learning cart.</h1><p>A good choice is the one that feels right for you.</p></div><span className="cart-item-count">{items.length} {items.length === 1 ? 'course' : 'courses'}</span></div>
      {cartError && <p className="form-error" role="alert">{cartError}</p>}
      {!loaded ? <p>Loading your cart…</p> : items.length === 0 ? <div className="empty-cart"><span><ShoppingBag size={22} /></span><h2>Your next skill is waiting.</h2><p>Explore practical courses and add the ones that fit your goals.</p><Link className="solid-link" href="/">Explore courses <ArrowRight size={15} /></Link></div> :
        <div className="cart-layout"><div className="cart-items">{items.map((item) => <article className="cart-item" key={item.id}>
          <div className="cart-art">{item.topic.split(/[ &]/).map((word) => word[0]).join('').slice(0, 2)}</div>
          <div className="cart-info"><Link href={`/courses/${item.slug}`}>{item.title}</Link><span>{item.topic} · {modeNames[item.mode]}</span><span>Course language: {item.language.toUpperCase()}</span>{item.batchId && <small>Batch selected · <Link href={`/courses/${item.slug}`}>Change</Link></small>}</div>
          <strong>{formatRupees(item.pricePaise)}</strong><button className="remove-item" aria-label={`Remove ${item.title}`} onClick={() => update(items.filter((current) => current.id !== item.id))}><Trash2 size={15} /></button>
        </article>)}</div>
          <aside className="cart-summary"><h2>Order summary</h2><div><span>Course fee</span><span>{formatRupees(subtotal - tax)}</span></div><div><span>GST (included)</span><span>{formatRupees(tax)}</span></div><div className="cart-total"><strong>Total incl. GST</strong><strong>{formatRupees(subtotal)}</strong></div><Link href="/checkout" className="checkout-button">Continue to checkout <ArrowRight size={16} /></Link><p><ShieldCheck size={14} /> Secure checkout · GST invoice included</p><small><Minus size={10} /> Need to choose a batch? Do it from your course page before checkout.</small></aside>
        </div>}
    </section><footer className="auth-footer cart-footer">UpSkillIN · Practical learning for your next opportunity <Link href="/refund-policy">Refund policy</Link></footer></main>;
}
