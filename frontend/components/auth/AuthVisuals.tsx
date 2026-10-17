'use client'

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import Image from 'next/image'

export type AuthIntroPhase = 'intro' | 'transition' | 'login'

const particles = [
  { x: '12%', y: '23%', delay: '-2s', size: 4 },
  { x: '21%', y: '69%', delay: '-7s', size: 3 },
  { x: '32%', y: '15%', delay: '-4s', size: 2 },
  { x: '38%', y: '83%', delay: '-9s', size: 4 },
  { x: '62%', y: '12%', delay: '-5s', size: 3 },
  { x: '72%', y: '79%', delay: '-3s', size: 2 },
  { x: '84%', y: '25%', delay: '-8s', size: 4 },
  { x: '91%', y: '59%', delay: '-6s', size: 3 },
  { x: '8%', y: '52%', delay: '-1s', size: 2 },
  { x: '78%', y: '47%', delay: '-10s', size: 2 },
  { x: '53%', y: '91%', delay: '-4s', size: 3 },
  { x: '94%', y: '82%', delay: '-7s', size: 2 },
]

export function AnimatedBackground() {
  return (
    <div className="login-ambient" aria-hidden="true">
      <div className="login-light login-light-cyan" />
      <div className="login-light login-light-violet" />
      <div className="login-orb login-orb-large" />
      <div className="login-orb login-orb-left" />
      <div className="login-orb login-orb-small" />
      <div className="login-wave login-wave-back" />
      <div className="login-wave login-wave-front" />
      {particles.map((particle, index) => (
        <span
          className="login-particle"
          key={index}
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            animationDelay: particle.delay,
          }}
        />
      ))}
      <svg className="login-orbit" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="fluxa-orbit-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#13dfff" stopOpacity=".08" />
            <stop offset="48%" stopColor="#20bcff" stopOpacity=".7" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity=".45" />
          </linearGradient>
          <filter id="fluxa-orbit-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <path id="fluxa-orbit-path" d="M 284 520 C 390 250, 1038 190, 1164 380 C 1280 554, 608 759, 368 578 C 267 502, 359 387, 539 320" />
        </defs>
        <use href="#fluxa-orbit-path" fill="none" stroke="url(#fluxa-orbit-gradient)" strokeWidth="1.2" />
        <circle r="5" fill="#62e9ff" filter="url(#fluxa-orbit-glow)">
          <animateMotion dur="22s" repeatCount="indefinite" rotate="auto">
            <mpath href="#fluxa-orbit-path" />
          </animateMotion>
        </circle>
        <circle r="3" fill="#b98aff" opacity=".9" filter="url(#fluxa-orbit-glow)">
          <animateMotion dur="22s" begin="-11s" repeatCount="indefinite" rotate="auto">
            <mpath href="#fluxa-orbit-path" />
          </animateMotion>
        </circle>
      </svg>
    </div>
  )
}

export function AuthIntro({
  phase,
  symbolRef,
  nameRef,
}: {
  phase: AuthIntroPhase
  symbolRef: RefObject<HTMLDivElement | null>
  nameRef: RefObject<HTMLParagraphElement | null>
}) {
  return (
    <div className={`login-intro-overlay${phase === 'transition' ? ' is-transitioning' : ''}`} aria-hidden="true">
      <div className="login-intro-particles">
        {Array.from({ length: 8 }, (_, index) => (
          <span
            className="login-intro-particle"
            key={index}
            style={{ '--particle-index': index } as CSSProperties & { '--particle-index': number }}
          />
        ))}
      </div>
      <div className="login-intro-brand">
        <div className="login-intro-mark">
          <div className="login-intro-symbol" ref={symbolRef}>
            <Image src="/fluxa-logo-glass.png" alt="" aria-hidden="true" width={140} height={140} priority />
          </div>
        </div>
        <div className="login-intro-copy">
          <p className="login-brand-name" ref={nameRef}>Fluxa</p>
        </div>
      </div>
    </div>
  )
}

export function useAuthIntro() {
  const [phase, setPhase] = useState<AuthIntroPhase>('intro')
  const introSymbolRef = useRef<HTMLDivElement>(null)
  const introNameRef = useRef<HTMLParagraphElement>(null)
  const brandLogoRef = useRef<HTMLDivElement>(null)
  const brandNameRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedMotionTimer = window.setTimeout(() => setPhase('login'), 0)
      return () => window.clearTimeout(reducedMotionTimer)
    }

    const introTimer = window.setTimeout(() => setPhase('transition'), 1950)
    return () => window.clearTimeout(introTimer)
  }, [])

  useEffect(() => {
    if (phase !== 'transition') return

    const introSymbol = introSymbolRef.current?.querySelector('img')
    const introName = introNameRef.current
    const loginLogo = brandLogoRef.current?.querySelector('img')
    const loginName = brandNameRef.current
    const loginBrand = loginLogo?.closest<HTMLElement>('.login-brand')
    const card = loginLogo?.closest<HTMLElement>('.login-card')
    const transitionAnimations: Animation[] = []
    const finishTimer = window.setTimeout(() => setPhase('login'), 1050)

    if (introSymbol && introName && loginLogo && loginName && loginBrand && card) {
      const frame = window.requestAnimationFrame(() => {
        const cardStyles = getComputedStyle(card)
        const transform = cardStyles.transform === 'none' ? new DOMMatrix() : new DOMMatrix(cardStyles.transform)
        const transformOrigin = cardStyles.transformOrigin.split(' ')
        const scaleOriginX = Number.parseFloat(transformOrigin[0])
        const scaleOriginY = Number.parseFloat(transformOrigin[1])
        const scaleX = Math.hypot(transform.a, transform.b)
        const scaleY = Math.hypot(transform.c, transform.d)
        const cardRect = card.getBoundingClientRect()
        const layoutLeft = cardRect.left - scaleOriginX - transform.e + scaleX * scaleOriginX
        const layoutTop = cardRect.top - scaleOriginY - transform.f + scaleY * scaleOriginY

        const animateSymbolTo = (source: HTMLElement, target: HTMLElement) => {
          const from = source.getBoundingClientRect()
          const targetRect = target.getBoundingClientRect()
          const targetX = layoutLeft + scaleOriginX
            + (targetRect.left + targetRect.width / 2 - layoutLeft - scaleOriginX - transform.e) / scaleX
          const targetY = layoutTop + scaleOriginY
            + (targetRect.top + targetRect.height / 2 - layoutTop - scaleOriginY - transform.f) / scaleY
          const targetScaleX = targetRect.width / scaleX / from.width
          const targetScaleY = targetRect.height / scaleY / from.height
          const x = targetX - (from.left + from.width / 2)
          const y = targetY - (from.top + from.height / 2)
          const destination = `translate(${x}px, ${y}px) scale(${targetScaleX}, ${targetScaleY})`

          transitionAnimations.push(source.animate(
            [
              { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
              { transform: destination, opacity: 1, offset: 0.82 },
              { transform: destination, opacity: 0, offset: 1 },
            ],
            { duration: 1000, easing: 'cubic-bezier(.2, .75, .25, 1)', fill: 'forwards' },
          ))
        }

        animateSymbolTo(introSymbol, loginLogo)
        transitionAnimations.push(introName.animate(
          [
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-4px)' },
          ],
          { duration: 320, easing: 'ease-out', fill: 'forwards' },
        ))
        transitionAnimations.push(loginLogo.animate(
          [
            { opacity: 0, offset: 0 },
            { opacity: 0, offset: 0.8 },
            { opacity: 1, offset: 1 },
          ],
          { duration: 1000, easing: 'ease-out', fill: 'forwards' },
        ))
      })

      return () => {
        window.cancelAnimationFrame(frame)
        transitionAnimations.forEach((animation) => animation.cancel())
        window.clearTimeout(finishTimer)
      }
    }

    return () => window.clearTimeout(finishTimer)
  }, [phase])

  return { phase, introSymbolRef, introNameRef, brandLogoRef, brandNameRef }
}
