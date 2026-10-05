'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, Plus, Upload } from 'lucide-react';
import { API_URL } from '@/lib/api';

type AdminCourse = { id: string; title: string; topic: string; pricePaise: number; published: boolean; _count: { enrollments: number; reviews: number } };
type AdminInstructor = { id: string; user: { name: string } };

export function CourseAdmin() {
  const [token, setToken] = useState('');
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [instructors, setInstructors] = useState<AdminInstructor[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const accessToken = localStorage.getItem('upskillin-access-token');
    if (!accessToken) {
      window.location.href = '/login?redirect=%2Fadmin%2Fcourses';
      return;
    }
    setToken(accessToken);
    void load(accessToken).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Course admin could not load.'));
  }, []);

  async function load(accessToken = token) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [coursesResponse, instructorsResponse] = await Promise.all([
      fetch(`${API_URL}/admin/courses`, { headers }),
      fetch(`${API_URL}/admin/courses/instructors`, { headers }),
    ]);
    const data = await coursesResponse.json() as AdminCourse[] | { message?: string };
    const instructorData = await instructorsResponse.json() as AdminInstructor[] | { message?: string };
    if (!coursesResponse.ok) throw new Error('message' in data ? data.message : 'Course admin could not load.');
    if (!instructorsResponse.ok) throw new Error('message' in instructorData ? instructorData.message : 'Instructor list could not load.');
    setCourses(data as AdminCourse[]);
    setInstructors(instructorData as AdminInstructor[]);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError('');
    setNotice('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch(`${API_URL}/admin/courses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'),
          subtitle: form.get('subtitle'),
          description: form.get('description'),
          topic: form.get('topic'),
          language: form.get('language'),
          mode: form.get('mode'),
          priceRupees: Number(form.get('priceRupees')),
          instructorId: form.get('instructorId'),
        }),
      });
      const data = await response.json() as { title?: string; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'Course could not be created.');
      await load();
      setNotice(`${data.title ?? 'Course'} saved as a draft. Publish it when it is ready.`);
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Course could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(course: AdminCourse) {
    setError('');
    try {
      const response = await fetch(`${API_URL}/admin/courses/${course.id}/publish`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !course.published }),
      });
      if (!response.ok) throw new Error('Course status could not be changed.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Course status could not be changed.');
    }
  }

  return <main className="subpage"><header className="sub-nav"><Link href="/" className="brand"><span className="brand-icon"><GraduationCap size={20} /></span><span>upskill<span className="brand-in">in</span></span></Link><Link href="/" className="back-link"><ArrowLeft size={14} /> Storefront</Link></header><section className="admin-page"><span className="eyebrow">INSTRUCTOR & ADMIN STUDIO</span><h1>Make learning happen.</h1><p className="learning-intro">Create a course draft, then publish it for learners when it is ready.</p>{error && <p className="form-error">{error}</p>}{notice && <p className="admin-notice">{notice}</p>}
    <div className="admin-layout"><form className="admin-form" onSubmit={create}><div className="admin-form-title"><span><Plus size={17} /></span><div><h2>Create a course</h2><p>Start with the basics. Refine your learning path next.</p></div></div><label>Course title<input name="title" required minLength={4} maxLength={120} placeholder="e.g. SQL for Data Analysts" /></label><label>Short description<input name="subtitle" required minLength={8} maxLength={180} placeholder="What will learners be able to do?" /></label><label>Course description<textarea name="description" required minLength={30} maxLength={5000} rows={4} placeholder="Describe the learning experience, audience and outcomes." /></label><div className="admin-form-row"><label>Topic<input name="topic" required placeholder="Data & Analytics" /></label><label>Course language<select name="language" defaultValue="en"><option value="en">English</option><option value="hi">Hindi</option><option value="ta">Tamil</option><option value="te">Telugu</option><option value="kn">Kannada</option><option value="mr">Marathi</option><option value="bn">Bengali</option></select></label></div><div className="admin-form-row"><label>Delivery format<select name="mode"><option value="SELF_PACED">Online self-paced</option><option value="VIRTUAL">Virtual instructor-led</option><option value="PHYSICAL">Physical classroom</option></select></label><label>Price (INR)<input name="priceRupees" type="number" min="100" max="500000" step="1" required placeholder="1999" /></label></div>{instructors.length > 1 && <label>Instructor<select name="instructorId" required defaultValue=""><option value="" disabled>Choose a verified instructor</option>{instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.user.name}</option>)}</select></label>}{instructors.length === 1 && <input type="hidden" name="instructorId" value={instructors[0].id} />}{error && <p className="form-error">{error}</p>}<button className="auth-submit" disabled={busy}>{busy ? 'Saving draft…' : 'Save course draft'} <Upload size={15} /></button></form>
    <aside className="admin-course-list"><h2>Course library <span>{courses.length}</span></h2>{courses.length === 0 ? <p>Your courses will appear here.</p> : courses.map((course) => <article key={course.id}><div><strong>{course.title}</strong><small>{course.topic} · ₹{(course.pricePaise / 100).toLocaleString('en-IN')}</small><small>{course._count.enrollments} learners · {course._count.reviews} reviews</small></div><button onClick={() => void toggle(course)}>{course.published ? 'Published' : 'Draft'} <ArrowRight size={13} /></button></article>)}</aside></div>
  </section></main>;
}
