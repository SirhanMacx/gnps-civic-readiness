// See https://kit.svelte.dev/docs/types#app for documentation.
import type { SupabaseClient } from '@supabase/supabase-js';

export type StaffRole = 'counselor' | 'scrc_member' | 'admin';

export interface StaffUser {
  id: string;
  email: string;
  role: StaffRole;
  fullName: string;
}

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      /**
       * Per-request Supabase client created via @supabase/ssr — reads/writes the auth cookie.
       * Use for auth operations (signInWithOtp, signOut, exchangeCodeForSession, getUser).
       * For privileged data access, prefer the supabaseAdmin() service-role client.
       */
      supabase: SupabaseClient;
      /** The currently logged-in staff user (joined from public.users on email), or null if anon. */
      user: StaffUser | null;
    }
    interface PageData {
      user?: StaffUser | null;
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
