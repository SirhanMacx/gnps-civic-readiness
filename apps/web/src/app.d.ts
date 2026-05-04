// See https://kit.svelte.dev/docs/types#app for documentation.

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
      /** The currently logged-in staff user (joined from public.users on the
       *  session-JWT's userId), or null if anon. */
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
