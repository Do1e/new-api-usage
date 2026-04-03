import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { jwtVerify } from 'jose';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(SESSION_SECRET));
      redirect('/dashboard');
    } catch {
      redirect('/login');
    }
  } else {
    redirect('/login');
  }
}