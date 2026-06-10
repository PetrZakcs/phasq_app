'use server';

import { createServerSideClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createServerSideClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signupAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;
  const organization = formData.get('organization') as string;
  const plan = (formData.get('plan') as string) || 'free';

  if (!email || !password || !fullName) {
    return { error: 'Email, password, and full name are required.' };
  }

  const supabase = await createServerSideClient();

  // 1. Sign up the user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`,
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  const user = authData.user;
  if (!user) {
    return { error: 'Signup failed. Please try again.' };
  }

  // Define hectare quota based on chosen plan
  let quota = 100;
  if (plan === 'agri_basic') quota = 1000;
  else if (plan === 'agri_pro') quota = 10000;
  else if (plan === 'defense') quota = 1000000;

  // 2. Insert profile record using standard client
  // Users have RLS allowing ALL operations if auth.uid() = id, which this is
  const { error: profileError } = await supabase.from('profiles').insert({
    id: user.id,
    email,
    full_name: fullName,
    organization: organization || null,
    plan,
    hectare_quota: quota,
    hectare_used: 0,
  });

  if (profileError) {
    console.error('Error creating profile:', profileError);
    // Ignore profile creation error if user is created (they can try logging in or we resolve it,
    // but we report to user for clarity)
    return { error: `Signup successful, but profile creation failed: ${profileError.message}` };
  }

  // Redirect to dashboard (or let them know to check email if verification is required)
  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = await createServerSideClient();
  await supabase.auth.signOut();
  redirect('/login');
}

