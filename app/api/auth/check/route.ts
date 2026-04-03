import { cookies } from 'next/headers';
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { jwtVerify } from 'jose';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }
    
    try {
      await jwtVerify(token, new TextEncoder().encode(SESSION_SECRET));
      return NextResponse.json({ authenticated: true });
    } catch {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Check auth error:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    );
  }
}