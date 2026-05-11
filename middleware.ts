import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image, favicon.ico
     * - service worker + PWA manifest (must be served from root, unauthed)
     * - public image assets
     */
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
