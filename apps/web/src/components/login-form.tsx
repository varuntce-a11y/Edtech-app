'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, ShieldCheck } from 'lucide-react';
import { API_URL } from '@/lib/api';

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identity, setIdentity] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [language, setLanguage] = useState('en');
  const [otpSent, setOtpSent] = useState(false);
  const [developmentCode, setDevelopmentCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [user, setUser] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'signup') setMode('register');
  }, []);

  const isEmail = identity.includes('@');
  const contact = isEmail ? { email: identity.trim() } : { phone: identity.trim() };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/auth/otp/${otpSent ? 'verify' : 'request'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(otpSent
          ? {
            ...contact,
            mode,
            code,
            name: name || undefined,
            targetRole: targetRole || undefined,
            educationLevel: educationLevel || undefined,
            experienceYears: experienceYears ? Number(experienceYears) : undefined,
            preferredLanguage: language,
            consent,
          }
          : { ...contact, mode }),
      });
      const data = await response.json() as { message?: string; developmentCode?: string; accessToken?: string; refreshToken?: string; user?: { name?: string } };
      if (!response.ok) throw new Error(data.message ?? 'We could not complete that request. Please try again.');
      if (!otpSent) {
        setOtpSent(true);
        setDevelopmentCode(data.developmentCode ?? '');
      } else if (data.accessToken) {
        localStorage.setItem('upskillin-access-token', data.accessToken);
        if (data.refreshToken) localStorage.setItem('upskillin-refresh-token', data.refreshToken);
        localStorage.setItem('upskillin-user', JSON.stringify(data.user));
        const cart = JSON.parse(localStorage.getItem('upskillin-cart') ?? '[]') as { id: string; batchId?: string }[];
        const mergeResults = await Promise.all(cart.map((item) => fetch(`${API_URL}/cart/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.accessToken}` },
          body: JSON.stringify({ courseId: item.id, batchId: item.batchId }),
        })));
        setUser(true);
        if (mergeResults.some((result) => !result.ok)) {
          setError('You’re signed in, but one or more courses could not sync to your account. Your browser cart is still saved.');
        } else {
          window.setTimeout(() => { window.location.href = new URLSearchParams(window.location.search).get('redirect') ?? '/'; }, 900);
        }
      } else throw new Error('Sign-in did not return an access token. Please try again.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not complete that request.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <div className="auth-top"><Link href="/" className="brand"><span className="brand-icon"><GraduationCap size={20} /></span><span>upskill<span className="brand-in">in</span></span></Link><Link href="/" className="back-link"><ArrowLeft size={14} /> Back to courses</Link></div>
    <div className="auth-grid"><section className="auth-story"><span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h1>One skill can<br />change your <i>next.</i></h1><p>Find practical learning that fits your life and takes you where you want to go.</p><div className="auth-points"><span><ShieldCheck size={16} />Your data stays yours</span><span><GraduationCap size={16} />Learn from verified instructors</span></div><div className="auth-orbit" /></section>
      <section className="auth-card"><span className="eyebrow">{user ? 'YOU’RE ALL SET' : otpSent ? 'ONE LAST STEP' : mode === 'register' ? 'CREATE YOUR UPSKILLIN ACCOUNT' : 'WELCOME TO UPSKILLIN'}</span><h2>{user ? 'You’re signed in.' : otpSent ? 'Check your messages.' : mode === 'register' ? 'Start your next chapter.' : 'Let’s get you moving.'}</h2><p>{user ? 'Taking you to the next step…' : otpSent ? `Enter the 6-digit code sent to ${identity}.` : mode === 'register' ? 'Create your free account and find practical learning for your career.' : 'Sign in to continue your learning journey.'}</p>
        {user && error && <div className="form-error" role="alert">{error}<Link className="login-cart-link" href="/cart">Review your saved cart <ArrowRight size={13} /></Link></div>}
        {!user && <form onSubmit={submit}>
          {!otpSent && <div className="auth-mode-switch" aria-label="Account access">
            <button type="button" aria-pressed={mode === 'login'} className={mode === 'login' ? 'auth-mode-active' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
            <button type="button" aria-pressed={mode === 'register'} className={mode === 'register' ? 'auth-mode-active' : ''} onClick={() => { setMode('register'); setError(''); }}>Register</button>
          </div>}
          {!otpSent && <label>Email or mobile number<input autoComplete="email" value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="you@example.com or +91 98765 43210" required /></label>}
          {!otpSent && mode === 'register' && <label>Your name<input autoComplete="name" minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="How should we address you?" required /></label>}
          {otpSent && <>
            <label>6-digit verification code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter your code" required /></label>
            <label>Education level<select value={educationLevel} onChange={(event) => setEducationLevel(event.target.value)}><option value="">Choose your education level (optional)</option><option>Undergraduate</option><option>Graduate</option><option>Postgraduate</option><option>Diploma</option><option>Other</option></select></label>
            <label>Years of experience<input type="number" min="0" max="60" value={experienceYears} onChange={(event) => setExperienceYears(event.target.value)} placeholder="Optional" /></label>
            <label>What are you working towards?<select value={targetRole} onChange={(event) => setTargetRole(event.target.value)}><option value="">Choose a career goal (optional)</option><option>Data Analyst</option><option>Software Developer</option><option>Business Analyst</option><option>Finance Professional</option><option>Product Manager</option><option>Career switch</option></select></label>
            <label>Preferred language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option><option value="ta">தமிழ்</option><option value="te">తెలుగు</option><option value="kn">ಕನ್ನಡ</option><option value="mr">मराठी</option><option value="bn">বাংলা</option></select></label>
            <label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>I agree to the <Link href="/privacy">privacy policy</Link> and consent to the processing of my details to provide learning services.</span></label>
          </>}
          {error && <div className="form-error" role="alert">{error}</div>}
          {developmentCode && <div className="dev-code">Local development code: <strong>{developmentCode}</strong></div>}
          <button className="auth-submit" disabled={busy || (otpSent && !consent)}>{busy ? 'Please wait…' : otpSent ? mode === 'register' ? 'Create account' : 'Sign in securely' : mode === 'register' ? 'Continue registration' : 'Continue with email or phone'} <ArrowRight size={16} /></button>
          {otpSent && <button type="button" className="resend-code" onClick={() => { setOtpSent(false); setDevelopmentCode(''); setCode(''); }}>Use a different email or number</button>}
        </form>}
        {!user && !otpSent && <div className="auth-legal">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</div>}
      </section>
    </div><footer className="auth-footer">Hassle-free upskilling for your next opportunity. <span>© 2026 UpSkillIN</span></footer>
  </main>;
}
