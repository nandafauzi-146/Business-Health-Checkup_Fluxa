import fs from 'node:fs'
import path from 'node:path'
import defaultContent from '@/content/landing-default.json'
import { getSuperAdminServiceClient } from '@/lib/supabase/super-admin'

export interface HeroContent {
  eyebrow: string
  badge: string
  title: string
  titleHighlight: string
  description: string
  ctaText: string
  ctaSecondaryText: string
  trustNote: string
}

export interface FeatureItem {
  icon: string
  title: string
  description: string
  tone: 'blue' | 'purple' | 'green' | 'orange' | 'cyan' | 'pink'
}

export interface AIInsightContent {
  eyebrow: string
  title: string
  titleHighlight: string
  description: string
  checklist: string[]
}

export interface StepItem {
  number: string
  icon: string
  label: string
  title: string
  description: string
  detail: string
}

export interface ContactContent {
  whatsappNumber: string
  whatsappMessage: string
  eyebrow: string
  heading: string
  description: string
  buttonText: string
}

export interface TrialBannerContent {
  pill: string
  title: string
  titleHighlight: string
  description: string
  ctaText: string
  footnote: string
}

export interface FAQItem {
  question: string
  answer: string
}

export interface PackageItem {
  name: string
  description: string
  priceLabel: string
  priceSublabel: string
  featured?: boolean
  badge?: string
  features: string[]
}

export interface PricingSectionContent {
  eyebrow: string
  title: string
  titleHighlight: string
  description: string
  buttonText: string
  packages: PackageItem[]
}

export interface FooterContent {
  tagline: string
  copyright: string
}

export interface LandingCMSContent {
  hero: HeroContent
  features: FeatureItem[]
  aiInsight: AIInsightContent
  steps: StepItem[]
  contact: ContactContent
  trialBanner: TrialBannerContent
  pricing: PricingSectionContent
  faqs: FAQItem[]
  footer: FooterContent
  updatedAt?: string
  updatedBy?: string
}

const CUSTOM_FILE_PATH = path.join(process.cwd(), 'content', 'landing-content.json')

export function getDefaultLandingContent(): LandingCMSContent {
  return JSON.parse(JSON.stringify(defaultContent)) as LandingCMSContent
}

export async function getLandingCMSContent(): Promise<LandingCMSContent> {
  const fallback = getDefaultLandingContent()

  // 1. Try reading from Supabase
  try {
    const admin = getSuperAdminServiceClient()
    const { data, error } = await admin
      .from('landing_cms_content')
      .select('content, updated_at, updated_by')
      .eq('id', 'default')
      .maybeSingle()

    if (!error && data?.content && typeof data.content === 'object') {
      return {
        ...fallback,
        ...(data.content as Record<string, unknown>),
        updatedAt: data.updated_at,
        updatedBy: data.updated_by,
      } as LandingCMSContent
    }
  } catch (err) {
    // Database query failed (table may not exist yet) - fallback to local storage
  }

  // 2. Try reading from local customized JSON file
  try {
    if (fs.existsSync(CUSTOM_FILE_PATH)) {
      const raw = fs.readFileSync(CUSTOM_FILE_PATH, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<LandingCMSContent>
      return {
        ...fallback,
        ...parsed,
      }
    }
  } catch (err) {
    console.error('Failed to read local landing-content.json:', err)
  }

  // 3. Fallback to factory default
  return fallback
}

export async function saveLandingCMSContent(
  content: LandingCMSContent,
  userId?: string | null
): Promise<{ success: boolean; data: LandingCMSContent; error?: string }> {
  const payload = {
    ...content,
    updatedAt: new Date().toISOString(),
    updatedBy: userId || 'super_admin',
  }

  // Save to disk first for immediate durability
  try {
    const dir = path.dirname(CUSTOM_FILE_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(CUSTOM_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8')
  } catch (diskErr) {
    console.warn('Warning: Could not save CMS content to disk:', diskErr)
  }

  // Try saving to Supabase if table is available
  try {
    const admin = getSuperAdminServiceClient()
    const { error } = await admin
      .from('landing_cms_content')
      .upsert({
        id: 'default',
        content: payload,
        updated_by: userId || null,
        updated_at: payload.updatedAt,
      })

    if (error) {
      console.warn('Supabase landing_cms_content upsert note (using local fallback):', error.message)
    }
  } catch (dbErr) {
    console.warn('Supabase landing_cms_content connection error (using local fallback):', dbErr)
  }

  return { success: true, data: payload }
}

export async function resetLandingCMSContent(
  userId?: string | null
): Promise<{ success: boolean; data: LandingCMSContent }> {
  const factory = getDefaultLandingContent()
  return await saveLandingCMSContent(factory, userId)
}
