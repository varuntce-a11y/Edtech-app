'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ArrowRight, BookOpen, Check, ChevronDown, Clock3, GraduationCap, LogOut, Menu, Search, SlidersHorizontal, Sparkles, Star, UserRound, X } from 'lucide-react';
import { API_URL, CatalogResponse, Course, formatRupees, languageNames, modeNames } from '@/lib/api';

const topics = ['Data & Analytics', 'Artificial Intelligence', 'Finance & GST', 'Communication', 'Interview Prep', 'Software Development', 'Career & Business', 'Design & Creativity'];
const languages = ['en', 'hi', 'ta', 'te', 'kn', 'mr', 'bn'];
const blankFilters = { q: '', topic: '', language: '', mode: '', assessment: '', instructor: '', minPrice: '', maxPrice: '', sort: 'relevance' };
type Filters = typeof blankFilters;
type AccountProfile = {
  email?: string | null;
  phone?: string | null;
  role?: string;
  profile?: {
    educationLevel?: string | null;
    experienceYears?: number | null;
    targetRole?: string | null;
    preferredLanguage?: string | null;
    city?: string | null;
  } | null;
};

function getInitialFilters(): Filters {
  if (typeof window === 'undefined') return blankFilters;
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(Object.keys(blankFilters).map((key) => [key, params.get(key) ?? blankFilters[key as keyof Filters]])) as Filters;
}

function CourseCard({ course, onAdd }: { course: Course; onAdd: (course: Course) => void }) {
  const initial = course.topic.split(/[ &]/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  return (
    <article className="course-card">
      <Link href={`/courses/${course.slug}`} className="course-art" aria-label={`View ${course.title}`}>
        <div className="art-orbit" />
        <span className="art-topic">{course.topic}</span>
        <span className="art-mark">{initial}</span>
        <span className="art-label">UPSKILL YOUR NEXT</span>
      </Link>
      <div className="course-body">
        <div className="course-meta"><span>{course.level}</span><span className="dot">·</span><span>{modeNames[course.mode]}</span></div>
        <Link href={`/courses/${course.slug}`} className="course-title">{course.title}</Link>
        <p className="course-subtitle">{course.subtitle}</p>
        <div className="course-instructor"><span className="avatar">{String(typeof course.instructor === 'string' ? course.instructor : course.instructor.name).slice(0, 1)}</span>{typeof course.instructor === 'string' ? course.instructor : course.instructor.name}</div>
        <div className="rating-line"><span className="rating"><Star size={14} fill="currentColor" /> {course.rating.toFixed(1)}</span><span className="review-count">({course.reviewCount} reviews)</span><span className="course-duration"><Clock3 size={14} /> {course.durationHours}h</span></div>
        <div className="course-bottom">
          <span className="course-price">{formatRupees(course.pricePaise)} <small>incl. GST</small></span>
          <button className="add-button" onClick={() => onAdd(course)} aria-label={`Add ${course.title} to cart`}><span>Add</span><span className="plus">+</span></button>
        </div>
      </div>
    </article>
  );
}

export function Catalog() {
  const [filters, setFilters] = useState<Filters>(getInitialFilters);
  const [result, setResult] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [userName, setUserName] = useState('');
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && !(key === 'sort' && value === 'relevance')) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const accessToken = localStorage.getItem('upskillin-access-token');
      const response = await fetch(`${API_URL}/courses${queryString ? `?${queryString}` : ''}`, {
        cache: 'no-store',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
      setResult(await response.json() as CatalogResponse);
    } catch {
      setError('We couldn’t reach the course catalog. Check that the API and database are running, then try again.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const params = new URLSearchParams(queryString);
    const nextUrl = params.size ? `/?${params.toString()}` : '/';
    window.history.replaceState(null, '', nextUrl);
    const timeout = window.setTimeout(() => { void loadCourses(); }, filters.q ? 280 : 0);
    return () => window.clearTimeout(timeout);
  }, [filters.q, queryString, loadCourses]);

  useEffect(() => {
    const storedUser = localStorage.getItem('upskillin-user');
    if (localStorage.getItem('upskillin-access-token') && storedUser) {
      try {
        const user = JSON.parse(storedUser) as { name?: unknown } & AccountProfile;
        if (typeof user.name === 'string') {
          setUserName(user.name.trim());
          setAccountProfile(user);
        }
      } catch (cause) {
        console.error('Could not read the signed-in user from browser storage.', cause);
      }
    }

    try {
      const cart = JSON.parse(localStorage.getItem('upskillin-cart') ?? '[]') as Course[];
      setCartCount(cart.length);
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen]);

  async function signOut() {
    setSigningOut(true);
    const refreshToken = localStorage.getItem('upskillin-refresh-token');
    let revokeError: unknown;
    if (refreshToken) {
      try {
        const response = await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) throw new Error(`Session revocation failed (${response.status})`);
      } catch (cause) {
        revokeError = cause;
        console.error('Could not revoke the server session during sign out.', cause);
      }
    }
    localStorage.removeItem('upskillin-access-token');
    localStorage.removeItem('upskillin-refresh-token');
    localStorage.removeItem('upskillin-user');
    setUserName('');
    setAccountProfile(null);
    setAccountMenuOpen(false);
    setSigningOut(false);
    setToast(revokeError ? 'Signed out on this device, but the server session could not be revoked.' : 'You have been signed out.');
    window.setTimeout(() => setToast(''), 4000);
  }

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function addToCart(course: Course) {
    if (course.mode !== 'SELF_PACED') {
      window.location.href = `/courses/${course.slug}`;
      return;
    }
    try {
      const cart = JSON.parse(localStorage.getItem('upskillin-cart') ?? '[]') as Course[];
      const updated = cart.some((item) => item.id === course.id) ? cart : [...cart, course];
      localStorage.setItem('upskillin-cart', JSON.stringify(updated));
      setCartCount(updated.length);
      setToast(updated.length === cart.length ? 'Already in your cart' : 'Added to your cart');
      window.setTimeout(() => setToast(''), 2400);
    } catch {
      setToast('Your browser could not save the cart. Please try again.');
    }
  }

  const activeFilters = Object.entries(filters).filter(([key, value]) =>
    value && !(key === 'sort' && value === 'relevance') && !(key === 'minPrice' && value === '0') && !(key === 'maxPrice' && value === '15000'),
  );

  return (
    <main>
      <div className="announcement"><Sparkles size={14} /><span>Your next opportunity starts with one new skill.</span><span className="announcement-link">Find your next skill <ArrowRight size={13} /></span></div>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="UpSkillIN home"><span className="brand-icon"><GraduationCap size={21} /></span><span>upskill<span className="brand-in">in</span></span></Link>
        <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`} aria-label="Main navigation">
          <a className="nav-active" href="#courses">Explore courses</a>
          <a href="#topics">Career paths</a>
          <a href="#how-it-works">For instructors</a>
        </nav>
        <div className="header-actions">
          <Link href="/my-courses" className="header-cart"><BookOpen size={18} /><span>My learning</span></Link>
          <Link href="/cart" className="cart-button" aria-label={`Cart, ${cartCount} items`}><span>Cart</span><span className="cart-count">{cartCount}</span></Link>
          {userName
            ? <div className="account-menu-root" ref={accountMenuRef}>
              <button className="account-trigger" type="button" aria-label={`Account details for ${userName}`} aria-expanded={accountMenuOpen} aria-controls="account-details-menu" onClick={() => setAccountMenuOpen((open) => !open)}>
                <UserRound size={17} /><span className="account-trigger-name">{userName}</span><ChevronDown size={13} />
              </button>
              {accountMenuOpen && <section className="account-menu" id="account-details-menu" aria-label="Account details">
                <div className="account-menu-heading"><UserRound size={18} /><div><strong>{userName}</strong><span>{accountProfile?.role?.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()) ?? 'Learner'} account</span></div></div>
                <dl className="account-profile">
                  {(accountProfile?.email || accountProfile?.phone) && <div><dt>Contact</dt><dd>{accountProfile.email || accountProfile.phone}</dd></div>}
                  {accountProfile?.profile?.educationLevel && <div><dt>Education</dt><dd>{accountProfile.profile.educationLevel}</dd></div>}
                  {accountProfile?.profile?.experienceYears != null && <div><dt>Experience</dt><dd>{accountProfile.profile.experienceYears} {accountProfile.profile.experienceYears === 1 ? 'year' : 'years'}</dd></div>}
                  {accountProfile?.profile?.targetRole && <div><dt>Career goal</dt><dd>{accountProfile.profile.targetRole}</dd></div>}
                  {accountProfile?.profile?.preferredLanguage && <div><dt>Language</dt><dd>{languageNames[accountProfile.profile.preferredLanguage] ?? accountProfile.profile.preferredLanguage}</dd></div>}
                  {accountProfile?.profile?.city && <div><dt>City</dt><dd>{accountProfile.profile.city}</dd></div>}
                </dl>
                <Link className="account-learning-link" href="/my-courses" onClick={() => setAccountMenuOpen(false)}>My Learning <ArrowRight size={14} /></Link>
                <button className="account-signout" type="button" onClick={() => void signOut()} disabled={signingOut}><LogOut size={15} />{signingOut ? 'Signing out…' : 'Sign out'}</button>
              </section>}
            </div>
            : <><Link href="/login" className="login-button">Log in</Link><Link href="/login?mode=signup" className="signup-button">Get started <ArrowRight size={15} /></Link></>}
        </div>
        <button className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu ? <X /> : <Menu />}</button>
      </header>

      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow"><span className="eyebrow-dot" /> BUILT FOR YOUR NEXT CHAPTER</div>
          <h1>Small steps.<br /><span>Big career moves.</span></h1>
          <p>Real skills for the job you want. Learn from people who’ve been there — at a pace that works for you.</p>
          <a className="hero-cta" href="#courses">Explore courses <ArrowRight size={17} /></a>
          <div className="hero-proof"><div className="proof-avatars"><span>R</span><span>P</span><span>A</span><span>+</span></div><div><strong>Made for your career journey</strong><small>Practical learning. Real outcomes.</small></div></div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-sun" />
          <div className="hero-card hero-card-back"><span className="card-kicker">YOUR NEXT SKILL</span><span className="tiny-bars"><i /><i /><i /><i /><i /><i /><i /></span><span className="tiny-caption">Progress looks good</span></div>
          <div className="hero-card hero-card-front"><span className="play-circle"><ArrowRight size={20} /></span><span className="hero-course-tag">A SKILL THAT OPENS DOORS</span><strong>Learn something<br />that moves you.</strong><span className="hero-dash" /></div>
          <div className="hero-stamp"><span>LEARN</span><strong>→</strong><span>GROW</span></div>
        </div>
        <div className="hero-footnote">CURIOUS TODAY. CAPABLE TOMORROW.</div>
      </section>

      <section id="topics" className="topic-strip">
        <div><span className="strip-label">A SKILL FOR EVERY NEXT STEP</span><div className="topic-list">{topics.slice(0, 6).map((topic) => <button key={topic} onClick={() => { updateFilter('topic', topic); document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' }); }}>{topic}<ArrowRight size={13} /></button>)}</div></div>
      </section>
      <RecommendationRail />

      <section className="catalog-section" id="courses">
        <div className="section-top">
          <div><div className="eyebrow section-eyebrow">THE COURSE COLLECTION</div><h2>Find your <span>next skill.</span></h2><p>Good things happen when you keep learning.</p></div>
          <a className="view-learning" href="/cart">Your learning journey <ArrowRight size={15} /></a>
        </div>
        <div className="search-row">
          <label className="search-field"><Search size={18} /><input aria-label="Search courses" placeholder="What would you like to learn?" value={filters.q} onChange={(event) => updateFilter('q', event.target.value)} /><kbd>↵</kbd></label>
          <button className={`filter-toggle ${showFilters ? 'filter-on' : ''}`} onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} /> Filters {activeFilters.length > 0 && <span>{activeFilters.length}</span>}<ChevronDown size={14} /></button>
          <label className="sort-select"><ArrowDownUp size={15} /><select aria-label="Sort courses" value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}><option value="relevance">Most relevant</option><option value="newest">Newest</option><option value="rating">Top rated</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label>
        </div>
        {showFilters && <div className="filter-panel">
          <label>Topic<select value={filters.topic} onChange={(event) => updateFilter('topic', event.target.value)}><option value="">All topics</option>{topics.map((topic) => <option key={topic}>{topic}</option>)}</select></label>
          <label>Delivery<select value={filters.mode} onChange={(event) => updateFilter('mode', event.target.value)}><option value="">Any format</option><option value="self_paced">Self-paced</option><option value="virtual">Live online</option><option value="physical">Classroom</option></select></label>
          <label>Course language<select value={filters.language} onChange={(event) => updateFilter('language', event.target.value)}><option value="">Any language</option>{languages.map((language) => <option key={language} value={language}>{languageNames[language]}</option>)}</select></label>
          <label>Assessment<select value={filters.assessment} onChange={(event) => updateFilter('assessment', event.target.value)}><option value="">Any</option><option value="yes">Required</option><option value="no">Not required</option></select></label>
          <label>Instructor<input value={filters.instructor} onChange={(event) => updateFilter('instructor', event.target.value)} placeholder="Instructor name" /></label>
          <label>Min. price · ₹{Number(filters.minPrice || 0).toLocaleString('en-IN')}<input aria-label="Minimum price in rupees" type="range" min="0" max="15000" step="500" value={filters.minPrice || '0'} onChange={(event) => updateFilter('minPrice', event.target.value)} /></label>
          <label>Max. price · {filters.maxPrice ? `₹${Number(filters.maxPrice).toLocaleString('en-IN')}` : 'No limit'}<input aria-label="Maximum price in rupees" type="range" min="0" max="15000" step="500" value={filters.maxPrice || '15000'} onChange={(event) => updateFilter('maxPrice', event.target.value === '15000' ? '' : event.target.value)} /></label>
          <button className="clear-filters" onClick={() => setFilters(blankFilters)}>Clear all <X size={13} /></button>
        </div>}
        <div className="results-line"><span>{loading ? 'Finding the right courses…' : error ? 'Course results are unavailable' : `${result?.total ?? 0} ${(result?.total ?? 0) === 1 ? 'course' : 'courses'} to explore`}</span>{activeFilters.length > 0 && <button onClick={() => setFilters(blankFilters)}>Clear filters <X size={13} /></button>}</div>
        {error ? <div className="catalog-message"><p>{error}</p><button className="retry-button" onClick={() => void loadCourses()}>Try again</button></div>
          : loading ? <div className="course-grid">{[1, 2, 3, 4].map((item) => <div className="course-skeleton" key={item}><div /><span /><span /></div>)}</div>
            : result?.items.length ? <div className="course-grid">{result.items.map((course) => <CourseCard key={course.id} course={course} onAdd={addToCart} />)}</div>
              : <div className="empty-state"><span className="empty-icon"><Search size={22} /></span><h3>No courses found this time.</h3><p>Try another search or clear a filter — your next skill is out there.</p><button onClick={() => setFilters(blankFilters)}>See all courses <ArrowRight size={14} /></button></div>}
      </section>

      <section className="learning-banner" id="how-it-works"><div className="banner-star">✳</div><div><span className="eyebrow">YOUR CAREER, YOUR WAY</span><h2>Learning that fits<br />your <i>real life.</i></h2><p>Short on time? Start with one small step. Find expert-led, self-paced and classroom courses designed around the way India works and learns.</p><a href="#courses">Find a course that fits <ArrowRight size={15} /></a></div><div className="banner-steps"><div><span>01</span><strong>Pick a skill</strong><small>Start with where you want to go.</small></div><div><span>02</span><strong>Learn your way</strong><small>Online, in-person or at your pace.</small></div><div><span>03</span><strong>Take your next step</strong><small>Put your new skills to work.</small></div></div></section>

      <footer className="site-footer"><Link href="/" className="brand"><span className="brand-icon"><GraduationCap size={18} /></span><span>upskill<span className="brand-in">in</span></span></Link><span>Hassle-free upskilling for your next opportunity.</span><nav><a href="/refund-policy">Refund policy</a><a href="/privacy">Privacy</a><a href="/admin/courses">Teach with us</a></nav><small>© 2026 UpSkillIN · Made for India</small></footer>
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </main>
  );
}

function RecommendationRail() {
  const [courses, setCourses] = useState<(Course & { reason: string })[]>([]);
  useEffect(() => {
    const accessToken = localStorage.getItem('upskillin-access-token');
    fetch(`${API_URL}/recommendations`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} })
      .then(async (response) => {
        if (!response.ok) throw new Error('Recommendations unavailable');
        const data = await response.json() as (Course & { reason: string })[];
        setCourses(data.slice(0, 4));
      })
      .catch(() => setCourses([]));
  }, []);
  if (!courses.length) return null;
  return <section className="recommendation-rail"><div className="recommendation-title"><div><span className="eyebrow">A GOOD PLACE TO CONTINUE</span><h2>Picked for your <i>next step.</i></h2></div><span>Thoughtfully selected for your career journey</span></div><div className="recommendation-grid">{courses.map((course) => <Link className="recommendation-card" href={`/courses/${course.slug}`} key={course.id}><span>{course.topic}</span><strong>{course.title}</strong><small>{course.reason}</small><b>{formatRupees(course.pricePaise)} <ArrowRight size={14} /></b></Link>)}</div></section>;
}
