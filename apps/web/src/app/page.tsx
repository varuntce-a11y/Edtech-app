import type { Metadata } from 'next';
import { Catalog } from '@/components/catalog';

export const metadata: Metadata = {
  title: 'Discover courses | UpSkillIN',
};

export default function Home() {
  return <Catalog />;
}
