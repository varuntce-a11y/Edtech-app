'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, GraduationCap, MapPin, PlayCircle, ShieldCheck, Star, Users } from 'lucide-react';
import { API_URL, Course, formatRupees, languageNames, modeNames } from '@/lib/api';

const moneyBreakdown = (paise: number) => {
  const gst = Math.round(paise * 18 / 118);
  return { base: paise - gst, gst };
};

export function CourseDetails({ slug }: { slug: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState('');
  const [batchId, setBatchId] = useState('');
  const [toast, setToast] = useState('');
  useEffect(() => {
    let active = true;
    const locale = new URLSearchParams(window.location.search).get('locale');
    const accessToken = localStorage.getItem('upskillin-access-token');
    fetch(`${API_URL}/courses/${encodeURIComponent(slug)}${locale ? `?locale=${locale}` : ''}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? 'This course is no longer available.' : 'Course details could not be loaded.');
        return await response.json() as Course;
      })
      .then((data) => { if (active) setCourse(data); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Course details could not be loaded.'); });
    return () => { active = false; };
  }, [slug]);

  function addToCart() {
    if (!course) return;
    if (course.mode !== 'SELF_PACED' && !batchId) {
      setToast('Choose an upcoming batch to continue.');
      return;
    }
    try {
      const cart = JSON.parse(localStorage.getItem('upskillin-cart') ?? '[]') as (Course & { batchId?: string })[];
      const existing = cart.filter((item) => item.id !== course.id);
      localStorage.setItem('upskillin-cart', JSON.stringify([...existing, { ...course, batchId }]));
      setToast('Added to your cart.');
      window.setTimeout(() => setToast(''), 2500);
    } catch {
      setToast('Your browser could not save the cart. Please try again.');
    }
  }

  if (error) return <main className="subpage"><SiteNav /><div className="subpage-message"><h1>Course unavailable</h1><p>{error}</p><Link className="solid-link" href="/">Browse courses <ArrowRight size={15} /></Link></div></main>;
  if (!course) return <main className="subpage"><SiteNav /><div className="subpage-message">Loading course details…</div></main>;
  const instructor = typeof course.instructor === 'string' ? { name: course.instructor, bio: 'A verified instructor with practical industry experience.' } : course.instructor;
  const price = moneyBreakdown(course.pricePaise);

  return <main className="subpage"><SiteNav />
    <div className="detail-wrap">
      <Link href="/" className="back-link"><ArrowLeft size={14} /> All courses</Link>
      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-art"><span>{course.topic}</span><div><span>{course.topic.split(/[ &]/).map((word) => word[0]).join('').slice(0, 2)}</span></div><small>YOUR NEXT CHAPTER STARTS HERE</small></div>
          <div className="detail-tags"><span>{course.level}</span><span>{modeNames[course.mode]}</span><span>{languageNames[course.language] ?? course.language}</span></div>
          <h1>{course.title}</h1><p className="detail-subtitle">{course.subtitle}</p>
          <div className="detail-rating"><Star size={16} fill="currentColor" /><strong>{course.rating.toFixed(1)}</strong><span>({course.reviewCount} learner reviews)</span><span className="detail-separator">·</span><Users size={15} /><span>Career-ready learning</span></div>
          <div className="detail-instructor"><span className="instructor-avatar">{instructor.name[0]}</span><div><small>YOUR INSTRUCTOR</small><strong>{instructor.name}</strong><span>{instructor.headline ?? 'UpSkillIN verified instructor'}</span></div></div>
          <section className="detail-block"><span className="eyebrow">WHAT YOU'LL TAKE WITH YOU</span><h2>Skills you can put to work.</h2><div className="outcome-list">{(course.outcomes ?? ['Build practical, job-ready skills', 'Learn through real-world projects', 'Take a confident next step in your career']).map((outcome) => <div key={outcome}><Check size={16} />{outcome}</div>)}</div></section>
          <section className="detail-block syllabus-block"><span className="eyebrow">YOUR LEARNING PATH</span><h2>What you'll learn</h2>{course.modules?.length ? course.modules.map((module, index) => <details key={module.id} open={index === 0}><summary><span>{String(index + 1).padStart(2, '0')}</span>{module.title}<small>{module.lessons.length} lessons</small></summary><div className="lesson-list">{module.lessons.map((lesson) => <div key={lesson.id}><PlayCircle size={14} />{lesson.title}<span>{lesson.durationMin} min</span></div>)}</div></details>) : <p>Practical lessons, exercises and portfolio-building projects.</p>}</section>
          {course.reviews && course.reviews.length > 0 && <section className="detail-block"><span className="eyebrow">HEAR FROM LEARNERS</span><h2>Learning that makes a difference.</h2>{course.reviews.map((review) => <blockquote className="learner-review" key={review.id}><span className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><p>“{review.comment}”</p><cite>{review.user.name} · Verified learner</cite></blockquote>)}</section>}
        </div>
        <aside className="purchase-card">
          <div className="purchase-visual"><span>UPSKILLIN COURSE</span><strong>{course.title}</strong><small>Learn it. Use it. Move forward.</small></div>
          <div className="purchase-content">
            <div className="purchase-price">{formatRupees(course.pricePaise)}<span> incl. GST</span></div>
            <div className="gst-details"><span>Course fee</span><span>{formatRupees(price.base)}</span><span>GST (18%)</span><span>{formatRupees(price.gst)}</span></div>
            <div className="purchase-facts"><span><Clock3 size={15} />{course.durationHours} hours of learning</span><span><GraduationCap size={15} />Certificate of completion</span><span><ShieldCheck size={15} />Secure checkout</span></div>
            {course.mode !== 'SELF_PACED' && <label className="batch-label">Choose your batch<select value={batchId} onChange={(event) => setBatchId(event.target.value)}><option value="">Select an upcoming date</option>{course.batches?.map((batch) => <option key={batch.id} value={batch.id}>{new Date(batch.startsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{batch.city ? ` · ${batch.city}` : ' · Live online'} · {Math.max(0, batch.seatsTotal - batch.seatsTaken)} seats left</option>)}</select>{course.mode === 'PHYSICAL' && <small><MapPin size={13} /> Location is shared after enrolment</small>}</label>}
            <button className="purchase-cta" onClick={addToCart}>Add to cart <ArrowRight size={16} /></button>
            <Link href="/cart" className="buy-now" onClick={addToCart}>Go to cart</Link>
            {course.mandatoryAssessment && <div className="assessment-note"><Check size={14} /> Includes a mandatory assessment to earn your certificate.</div>}
            <p className="refund-note">Not the right fit? Review our <Link href="/refund-policy">refund policy</Link>.</p>
          </div>
        </aside>
      </div>
    </div>
    {toast && <div className="toast"><Check size={15} />{toast}</div>}
  </main>;
}

function SiteNav() {
  return <header className="sub-nav"><Link href="/" className="brand"><span className="brand-icon"><GraduationCap size={20} /></span><span>upskill<span className="brand-in">in</span></span></Link><Link href="/">Explore courses <ArrowRight size={14} /></Link></header>;
}
