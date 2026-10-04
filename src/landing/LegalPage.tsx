import type { ReactNode } from 'react'
import { SITE } from '../site'
import { BetaBadge, Wordmark } from './Section'

/**
 * Privacy and Terms. Plain statements of what the site actually does today —
 * update them before adding analytics, email collection or anything else that
 * touches personal data. Not reviewed by a lawyer.
 */

function Contact() {
  return SITE.contactEmail ? (
    <p>
      {SITE.operator ? `${SITE.operator} operates this site. ` : ''}Contact:{' '}
      <a className="text-accent underline" href={`mailto:${SITE.contactEmail}`}>
        {SITE.contactEmail}
      </a>
      .
    </p>
  ) : (
    <p>Contact details for the operator of this site will be published here.</p>
  )
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight text-ink">{children}</h2>
}

function Privacy() {
  return (
    <>
      <p className="text-lg">
        The short version: no accounts, no cookies, no analytics, and the calculator runs in your browser.
        {SITE.waitlist ? ' If you join the waiting list, we keep your name and email address to tell you when new tools launch.' : ''}
      </p>
      <H2>Your calculations</H2>
      <p>
        Everything you type into the calculator is processed on your own device. It is not sent to us or stored on a
        server. To make sharing possible, the current calculation is written into the page address after the “#”
        sign. Browsers do not send that part of an address to the website, but it does stay in your browser
        history, and anyone you send a link to can read the numbers in it.
      </p>
      <H2>Hosting</H2>
      <p>
        The site is hosted by Cloudflare. When your browser loads a page, Cloudflare processes the technical
        information any web request carries — such as your IP address, browser type, the time and the address
        requested — to deliver and protect the site. See{' '}
        <a className="text-accent underline" href="https://www.cloudflare.com/privacypolicy/">
          Cloudflare’s privacy policy
        </a>
        .
      </p>
      <H2>Cookies, storage and analytics</H2>
      <p>
        The site sets no cookies, stores nothing on your device, and uses no analytics or advertising tools. If
        usage analytics are added, this page will be updated first to say which provider is used and what it
        records.
      </p>
      {SITE.waitlist ? (
        <>
      <H2>Waiting list</H2>
      <p>
        If you join the waiting list, we collect your first name, surname and email address. Your browser sends them
        to this site’s server, which stores them in a Google Sheets spreadsheet held in Google’s
        cloud. Nothing is saved unless you submit the form.
      </p>
      <p>
        We use these details only to email you when new tools launch. We do not sell or share them, and we do not
        add you to any other list. We keep them until the waiting list closes or you ask to be removed, whichever
        comes first. The legal basis is your consent, which you can withdraw at any time by asking to be removed.
      </p>
        </>
      ) : null}
      <H2>Your rights</H2>
      <p>
        Under data protection laws such as the GDPR you can ask what personal data is held about you and ask for it
        to be corrected or deleted. Apart from the hosting records{SITE.waitlist ? ' and any waiting-list details' : ''}{' '}
        above, this site holds none.
      </p>
      <H2>Contact</H2>
      <Contact />
    </>
  )
}

function Terms() {
  return (
    <>
      <p className="text-lg">
        The calculator is free to use, needs no account, and is provided for education and information.
      </p>
      <H2>Not advice</H2>
      <p>
        This calculator is provided for educational and informational purposes only. It does not constitute
        investment, legal, tax or financial advice, and it does not recommend any investment. Speak to a qualified
        professional before making investment decisions.
      </p>
      <H2>Results are hypothetical</H2>
      <p>
        Results depend entirely on the assumptions you enter. Exit figures are hypothetical scenarios, not
        predictions, and actual investment outcomes may differ significantly. Paper values are implied by
        valuations and are not prices at which shares could necessarily be sold.
      </p>
      <H2>What the model leaves out</H2>
      <p>
        The calculator works from the investor’s side only. It prices every instrument at the valuation of the
        round it is written into, so SAFE and convertible loan caps, discounts and interest are not modelled. It
        treats later investors’ preferences as 1× non-participating, and it ignores taxes and currency movements.
      </p>
      <H2>No warranty</H2>
      <p>
        The calculator is provided “as is”, without any warranty that it is accurate, complete or available. To the
        extent the law allows, the operator is not liable for any loss arising from its use or from decisions made
        with it.
      </p>
      <H2>Shared links</H2>
      <p>A shared link carries the calculation in its address. You are responsible for who you share it with.</p>
      <H2>Changes and contact</H2>
      <p>These terms may change; the date below shows when they last did.</p>
      <Contact />
    </>
  )
}

export function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
  return (
    <>
      <header className="border-b border-rule bg-ground">
        <nav aria-label="Main" className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <a href="/" className="text-lg text-ink">
            <Wordmark />
          </a>
          <BetaBadge />
          <span className="grow" />
          <a
            href="/#calculator"
            className="shrink-0 rounded-full border border-accent bg-accent px-4 py-1.5 text-sm font-medium text-on-accent hover:opacity-90"
          >
            Use calculator
          </a>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">{page === 'privacy' ? 'Privacy' : 'Terms of use'}</h1>
        <div className="mt-6 flex flex-col gap-4 leading-relaxed text-ink-soft">{page === 'privacy' ? <Privacy /> : <Terms />}</div>
        <p className="mt-12 text-sm text-ink-faint">Last updated {SITE.legalUpdated}.</p>
      </main>
    </>
  )
}
