import { CourseDetails } from '@/components/course-details';

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CourseDetails slug={slug} />;
}
