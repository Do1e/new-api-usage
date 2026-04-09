import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { jwtVerify } from 'jose';

import { getSessionSecret } from '@/lib/env';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(getSessionSecret()));
      redirect('/dashboard');
    } catch {
      redirect('/login');
    }
  } else {
    redirect('/login');
  }
}
