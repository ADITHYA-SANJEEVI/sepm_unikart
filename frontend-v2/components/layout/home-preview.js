import Link from "next/link";
import { Button, Icon, MetricTile, StatusPill, Surface } from "@/components/system/primitives";

const trustSignals = [
  { title: "Verified Campus Community", description: "Profiles, listings, and meetups stay inside the student network for calmer transactions." },
  { title: "Affordable Student Deals", description: "Books, cycles, gadgets, and hostel essentials move quickly without marketplace noise." },
  { title: "Quick Chat And Meetups", description: "Message, shortlist, negotiate, and schedule handoffs without leaving the platform." },
];

const categoryTiles = ["Books", "Cycles", "Electronics", "Furniture", "Hostel Essentials", "Lab Tools"];

const featuredListings = [
  { title: "Casio FX-991 Calculator", price: "INR 2,150", meta: "Library side / Like New" },
  { title: "Mountain Bike", price: "INR 4,500", meta: "Tech Park / Good" },
  { title: "Mattress + Bedsheet Set", price: "INR 1,400", meta: "Hostel Square / Clean" },
  { title: "Sony Headphones", price: "INR 3,200", meta: "Admin Lawn / Barely used" },
];

const floatingCards = [
  { title: "Cycle", price: "INR 4,500", detail: "Ready for pickup", tone: "buying" },
  { title: "Exam Kit", price: "INR 1,250", detail: "Calculator + lamp", tone: "neutral" },
  { title: "Hostel Reset", price: "INR 2,100", detail: "Fan + storage", tone: "selling" },
];

const howItWorks = [
  { step: "1", title: "Search cleanly", description: "Browse by category, price, condition, and campus location without losing context." },
  { step: "2", title: "Shortlist fast", description: "Save items, compare options, and start conversations from the same surface." },
  { step: "3", title: "Meet safely", description: "Use built-in meetup planning and visible campus handoff spots for trust." },
];

export function HomePreview() {
  return (
    <div className="v2-home v2-landing-page">
      <section className="v2-landing-hero">
        <div className="v2-landing-hero-copy">
          <StatusPill tone="buying">Campus-only marketplace</StatusPill>
          <h1>Buy and sell within your campus community, with less noise and more trust.</h1>
          <p>
            UniKart brings second-hand student essentials into one premium, mobile-first marketplace with calm discovery, secure chat, saved shortlists, and smoother meetup planning.
          </p>

          <div className="v2-landing-search">
            <span className="v2-landing-search-icon"><Icon name="search" /></span>
            <input defaultValue="" placeholder="Search for books, cycles, calculators, furniture..." aria-label="Search listings" />
            <Button href="/marketplace">Explore Listings</Button>
          </div>

          <div className="v2-page-header-actions">
            <Button href="/marketplace">Explore Listings</Button>
            <Button href="/sell" variant="secondary">Sell An Item</Button>
          </div>

          <div className="v2-landing-chip-row">
            {categoryTiles.map((item) => (
              <Link key={item} href={`/marketplace?category=${encodeURIComponent(item.toLowerCase().replaceAll(" ", "-"))}`} className="v2-filter-chip">
                {item}
              </Link>
            ))}
          </div>
        </div>

        <div className="v2-landing-hero-preview">
          <div className="v2-floating-stage">
            {floatingCards.map((card, index) => (
              <article key={card.title} className={`v2-floating-card v2-floating-card-${index + 1}`}>
                <span>{card.title}</span>
                <strong>{card.price}</strong>
                <small>{card.detail}</small>
                <StatusPill tone={card.tone}>{index === 0 ? "Negotiable" : index === 1 ? "Exam season" : "Hostel ready"}</StatusPill>
              </article>
            ))}
            <div className="v2-floating-feature-card">
              <div>
                <span>Featured Listing</span>
                <strong>Mountain Bike</strong>
                <small>Good condition / 2.4 km from hostel square</small>
              </div>
              <div className="v2-floating-feature-wheel" />
            </div>
          </div>
        </div>
      </section>

      <section className="v2-trust-grid">
        {trustSignals.map((item) => (
          <Surface key={item.title} title={item.title} description={item.description} className="v2-trust-card" />
        ))}
      </section>

      <section className="v2-landing-section">
        <div className="v2-landing-section-head">
          <div>
            <p className="v2-eyebrow">Trending Categories</p>
            <h2>Structured discovery that still feels quick.</h2>
          </div>
          <Button href="/marketplace" variant="ghost">Browse all</Button>
        </div>
        <div className="v2-category-tile-grid">
          {categoryTiles.map((item) => (
            <Link key={item} href="/marketplace" className="v2-category-tile">
              <span>{item}</span>
              <strong>{item === "Books" ? "Semester-ready picks" : item === "Cycles" ? "Commute deals" : "High-turnover campus items"}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="v2-landing-section">
        <div className="v2-landing-section-head">
          <div>
            <p className="v2-eyebrow">Featured Listings</p>
            <h2>Premium cards for the listings students open first.</h2>
          </div>
        </div>
        <div className="v2-featured-grid">
          {featuredListings.map((item) => (
            <article key={item.title} className="v2-featured-card">
              <div className="v2-featured-card-media" />
              <div className="v2-featured-card-copy">
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </div>
              <div className="v2-featured-card-price">{item.price}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="v2-landing-section">
        <div className="v2-landing-section-head">
          <div>
            <p className="v2-eyebrow">How It Works</p>
            <h2>Move from search to handoff without messy context switches.</h2>
          </div>
        </div>
        <div className="v2-how-grid">
          {howItWorks.map((item) => (
            <article key={item.step} className="v2-how-card">
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="v2-landing-safety">
        <div>
          <p className="v2-eyebrow">Safety Note</p>
          <h2>Meet in visible campus areas, inspect items first, and keep chat inside the app.</h2>
        </div>
        <div className="v2-metric-grid v2-metric-grid-wide">
          <MetricTile label="Saved" value="Shortlist" detail="Keep likely buys together" tone="buying" href="/favorites" />
          <MetricTile label="Messages" value="Contextual" detail="Listing-linked conversation threads" tone="neutral" href="/messages" />
          <MetricTile label="Sell Studio" value="Live" detail="Create listings with a polished preview" tone="selling" href="/sell" />
          <MetricTile label="Meetups" value="Planned" detail="Structured handoff routes and places" tone="safety" href="/schedules" />
        </div>
      </section>
    </div>
  );
}
