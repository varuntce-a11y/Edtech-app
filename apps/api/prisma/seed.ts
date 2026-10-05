import { PrismaClient, DeliveryMode } from '@prisma/client';

const prisma = new PrismaClient();
const topics: Record<string, string[]> = {
  'Data & Analytics': ['Excel Mastery for Business Analysts', 'SQL for Data Analysts', 'Power BI Dashboard Bootcamp', 'Statistics for Decision Making', 'Python for Data Analysis', 'Advanced Excel: Models & Automation'],
  'Artificial Intelligence': ['Generative AI for the Workplace', 'Machine Learning Foundations with Python', 'Prompt Engineering for Professionals', 'Applied Deep Learning Essentials', 'AI Product Management', 'Practical Natural Language Processing'],
  'Finance & GST': ['GST Returns & Compliance in India', 'TallyPrime with GST: Practical Accounting', 'Financial Modeling for Analysts', 'Personal Finance & Tax Planning', 'Advanced Excel for Finance Teams', 'Business Accounting Fundamentals'],
  'Communication': ['Business English for the Workplace', 'Confident Public Speaking', 'Professional Writing & Email Etiquette', 'Workplace Communication Skills', 'Presentation Skills for Professionals', 'Negotiation & Stakeholder Management'],
  'Interview Prep': ['Crack the Data Analyst Interview', 'Aptitude & Logical Reasoning', 'Behavioural Interview Masterclass', 'Resume Writing & LinkedIn Makeover', 'System Design Interview Foundations', 'Campus to Corporate: Job Readiness'],
  'Software Development': ['Full-Stack Web Development with React', 'Python Programming from Scratch', 'Java & Spring Boot Foundations', 'Git, GitHub & Collaborative Workflows', 'Cloud Fundamentals on AWS', 'API Design with Node.js'],
  'Career & Business': ['Product Management Foundations', 'Agile Project Management', 'Digital Marketing with Analytics', 'Entrepreneurship: Idea to First Customer', 'People Management for New Managers', 'Business Strategy Essentials'],
  'Design & Creativity': ['UI/UX Design with Figma', 'Visual Design Fundamentals', 'Data Storytelling & Visualisation', 'Canva for Business Content', 'Design Thinking for Innovation', 'Portfolio Building for Designers'],
};
const languages = ['en', 'hi', 'ta', 'te', 'kn', 'mr', 'bn'];
const delivery = [DeliveryMode.SELF_PACED, DeliveryMode.VIRTUAL, DeliveryMode.PHYSICAL];
const cities = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai'];

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@upskillin.demo' },
    create: { email: 'admin@upskillin.demo', name: 'UpSkillIN Admin', role: 'ADMIN' },
    update: { role: 'ADMIN' },
  });
  const instructors = await Promise.all([
    ['Aarav Mehta', 'Senior industry practitioner with 12+ years of experience turning complex concepts into practical skills.'],
    ['Priya Nair', 'Educator and consultant helping early-career professionals build confidence and job-ready portfolios.'],
    ['Karthik Iyer', 'Data and technology leader who has mentored thousands of learners across India.'],
    ['Neha Sharma', 'Finance professional and certified trainer focused on hands-on, real-world learning.'],
  ].map(async ([name, bio], index) => {
    const email = `instructor${index + 1}@upskillin.demo`;
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name, role: 'INSTRUCTOR' },
      update: { name, role: 'INSTRUCTOR' },
    });
    return prisma.instructor.upsert({
      where: { userId: user.id },
      create: { userId: user.id, bio, headline: 'UpSkillIN verified instructor', rating: 4.8 },
      update: { bio, headline: 'UpSkillIN verified instructor', rating: 4.8 },
    });
  }));

  let index = 0;
  for (const [topic, titles] of Object.entries(topics)) {
    const category = await prisma.category.upsert({
      where: { slug: topic.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      create: { name: topic, slug: topic.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      update: { name: topic },
    });
    for (const title of titles) {
      const mode = delivery[index % delivery.length];
      const language = languages[index % languages.length];
      const priceRupees = 799 + ((index * 389) % 6200);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const instructor = instructors[index % instructors.length];
      const course = await prisma.course.upsert({
        where: { slug },
        create: {
          slug,
          title,
          subtitle: `Build practical ${topic.toLowerCase()} skills for your next career move`,
          description: `${title} is a hands-on learning experience designed for Indian graduates and working professionals. Learn through practical exercises, real-world examples and expert guidance, then leave with skills you can demonstrate to employers.`,
          outcomes: [`Apply ${topic.toLowerCase()} skills to real-world tasks`, 'Build a portfolio-ready project', 'Prepare for your next career opportunity'],
          language,
          topic,
          level: index % 3 === 0 ? 'Beginner' : index % 3 === 1 ? 'Intermediate' : 'All levels',
          mode,
          pricePaise: priceRupees * 100,
          originalPricePaise: Math.round(priceRupees * 1.35) * 100,
          rating: 4.2 + (index % 8) / 10,
          reviewCount: 18 + (index * 13) % 210,
          durationHours: 4 + (index % 20),
          mandatoryAssessment: index % 4 === 0,
          published: true,
          featured: index < 6,
          instructorId: instructor.id,
          ...(index % 4 === 0 ? {
            assessment: {
              create: {
                passingScore: 70,
                questions: [
                  { id: 'q1', prompt: `Which approach is most useful when applying ${topic} at work?`, options: ['Work from the business problem', 'Skip validating the result', 'Avoid documenting decisions'], correctIndex: 0 },
                  { id: 'q2', prompt: 'What makes a portfolio project useful to employers?', options: ['A clear problem and measurable outcome', 'A list of tools only', 'An unfinished screenshot'], correctIndex: 0 },
                  { id: 'q3', prompt: 'What is a strong next step after learning a new skill?', options: ['Apply it in a practical project', 'Wait until every tool is mastered', 'Keep the result private'], correctIndex: 0 },
                ],
              },
            },
          } : {}),
          modules: {
            create: [
              { title: 'Getting started', position: 1, lessons: { create: [{ title: 'Welcome and learning goals', durationMin: 12, position: 1 }, { title: 'Tools and setup', durationMin: 24, position: 2 }] } },
              { title: 'Core skills in practice', position: 2, lessons: { create: [{ title: 'Guided practical exercise', durationMin: 35, position: 1 }, { title: 'Build your project', durationMin: 45, position: 2 }] } },
            ],
          },
          ...(mode !== DeliveryMode.SELF_PACED ? {
            batches: {
              create: {
                city: mode === DeliveryMode.PHYSICAL ? cities[index % cities.length] : null,
                startsAt: new Date(Date.now() + (index % 8 + 1) * 7 * 86_400_000),
                endsAt: new Date(Date.now() + (index % 8 + 1) * 7 * 86_400_000 + 21 * 86_400_000),
                seatsTotal: 30,
                seatsTaken: index % 11,
              },
            },
          } : {}),
        },
        update: {
          title,
          published: true,
          pricePaise: priceRupees * 100,
          language,
          mode,
          instructorId: instructor.id,
        },
      });
      await prisma.courseCategory.upsert({
        where: { courseId_categoryId: { courseId: course.id, categoryId: category.id } },
        create: { courseId: course.id, categoryId: category.id },
        update: {},
      });
      await prisma.courseTranslation.upsert({
        where: { courseId_locale: { courseId: course.id, locale: language } },
        create: { courseId: course.id, locale: language, title, description: course.description },
        update: { title, description: course.description },
      });
      index += 1;
    }
  }
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    create: { code: 'WELCOME10', discountPct: 10, maxUses: 1000 },
    update: { active: true, discountPct: 10 },
  });
  console.log(`Seeded ${index} courses across ${Object.keys(topics).length} topics.`);
}

main().catch((error: unknown) => {
  console.error('Database seed failed:', error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
