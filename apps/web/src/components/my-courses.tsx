'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, GraduationCap, Play, Sparkles } from 'lucide-react';
import { API_URL, Course } from '@/lib/api';

type Enrollment = { id: string; status: string; progress?: { percentage: number }; course: Course };

export function MyCourses() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('upskillin-access-token');
    if (!token) {
      window.location.href = '/login?redirect=%2Fmy-courses';
      return;
    }
    fetch(`${API_URL}/my-courses`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Your learning could not be loaded. Please sign in again.');
        return await response.json() as Enrollment[];
      })
      .then(setEnrollments)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Learning could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);
  const active = enrollments.filter((entry) => entry.status !== 'COMPLETED');
  const completed = enrollments.filter((entry) => entry.status === 'COMPLETED');
  return <main className="subpage"><header className="sub-nav"><Link href="/" className="brand"><span className="brand-icon"><GraduationCap size={20} /></span><span>upskill<span className="brand-in">in</span></span></Link><Link href="/">Explore courses <ArrowRight size={14} /></Link></header><section className="my-courses-page"><span className="eyebrow">YOUR NEXT CHAPTER, IN MOTION</span><h1>Keep growing.</h1><p className="learning-intro">Every small lesson is a step forward.</p>{error && <p className="form-error">{error}</p>}{loading ? <p>Loading your learning…</p> : enrollments.length === 0 ? <div className="empty-cart"><span><Sparkles size={22} /></span><h2>Your learning journey starts here.</h2><p>Find the course that helps you take your next step.</p><Link className="solid-link" href="/">Explore courses <ArrowRight size={15} /></Link></div> : <>
    <h2 className="my-courses-heading">In progress <span>{active.length}</span></h2><div className="learning-grid">{active.map((entry) => <LearningCard key={entry.id} entry={entry} />)}</div>{completed.length > 0 && <><h2 className="my-courses-heading completed-heading">Completed <span>{completed.length}</span></h2><div className="learning-grid">{completed.map((entry) => <LearningCard key={entry.id} entry={entry} />)}</div></>}
    </>}</section></main>;
}

function LearningCard({ entry }: { entry: Enrollment }) {
  const progress = entry.progress?.percentage ?? 0;
  return <article className="learning-card"><span className="eyebrow">{entry.course.topic}</span><h3>{entry.course.title}</h3><p>{entry.course.subtitle}</p><div className="progress-row"><span>Course progress</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><Link href={`/courses/${entry.course.slug}`}><Play size={14} fill="currentColor" />{progress ? 'Resume learning' : 'Start learning'} <ArrowRight size={14} /></Link>{entry.course.mandatoryAssessment && entry.status !== 'COMPLETED' && <AssessmentPanel enrollmentId={entry.id} />} {entry.status === 'COMPLETED' && <span className="certificate-label">✓ Certificate earned</span>}</article>;
}

type Assessment = { id: string; passingScore: number; questions: { id: string; prompt: string; options: string[] }[] };

function AssessmentPanel({ enrollmentId }: { enrollmentId: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = typeof window === 'undefined' ? null : localStorage.getItem('upskillin-access-token');

  async function loadAssessment() {
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/my-courses/${enrollmentId}/assessment`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await response.json() as Assessment & { message?: string };
      if (!response.ok) throw new Error(data.message ?? 'Assessment could not be loaded.');
      setAssessment(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Assessment could not be loaded.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!assessment || !token) return;
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/my-courses/${enrollmentId}/assessment/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers: assessment.questions.map(({ id }) => ({ questionId: id, answerIndex: answers[id] })) }),
      });
      const data = await response.json() as { score?: number; passed?: boolean; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'Your answers could not be submitted.');
      setResult(data.passed ? `Assessment passed with ${data.score}%.` : `You scored ${data.score}%. Review the lessons and try again.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your answers could not be submitted.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="assessment-panel"><button className="assessment-toggle" onClick={() => assessment ? setAssessment(null) : void loadAssessment()}>{assessment ? 'Close assessment' : 'Take mandatory assessment'} <ArrowRight size={13} /></button>{busy && !assessment && <small>Loading assessment…</small>}{error && <p className="form-error" role="alert">{error}</p>}{assessment && <div className="assessment-questions">{assessment.questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.options.map((option, optionIndex) => <label key={option}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} />{option}</label>)}</fieldset>)}<button className="assessment-submit" disabled={busy || assessment.questions.some(({ id }) => answers[id] === undefined)} onClick={() => void submit()}>{busy ? 'Checking…' : 'Submit answers'}</button>{result && <p className="assessment-result">{result}</p>}</div>}</div>;
}
