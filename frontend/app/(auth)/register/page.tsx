import RegisterForm from '@/components/auth/RegisterForm'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    step?: string
    email?: string
    name?: string
    phone?: string
    error?: string
    fromGoogle?: string
  }>
}) {
  const params = await searchParams
  const validSteps = ['form', 'choice', 'plans', 'trial_submitted'] as const
  const initialStep = (validSteps.includes(params.step as (typeof validSteps)[number])
    ? params.step
    : 'form') as (typeof validSteps)[number]

  return (
    <RegisterForm
      initialStep={initialStep}
      initialEmail={params.email || ''}
      initialName={params.name || ''}
      initialPhone={params.phone || ''}
      initialError={params.error || ''}
      isGoogleUser={params.fromGoogle === '1'}
    />
  )
}
