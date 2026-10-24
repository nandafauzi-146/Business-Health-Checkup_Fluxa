import RegisterForm from '@/components/auth/RegisterForm'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; email?: string; name?: string; error?: string }>
}) {
  const params = await searchParams

  return (
    <RegisterForm
      initialStep={params.step === 'trial_submitted' ? 'trial_submitted' : 'form'}
      initialEmail={params.email || ''}
      initialName={params.name || ''}
      initialError={params.error || ''}
    />
  )
}
