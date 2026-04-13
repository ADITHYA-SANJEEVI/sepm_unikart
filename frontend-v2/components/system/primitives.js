import Link from "next/link";

export function Icon({ name, filled = false, className = "" }) {
  const common = {
    className: `v2-icon ${className}`.trim(),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  if (name === "heart") {
    return filled ? (
      <svg viewBox="0 0 24 24" className={`v2-icon ${className}`.trim()} aria-hidden="true">
        <path
          d="M12 20.5c-4.8-3.7-8-6.5-8-10.2C4 7.1 6.4 5 9.1 5c1.6 0 3 .8 3.9 2.1C13.9 5.8 15.3 5 16.9 5 19.6 5 22 7.1 22 10.3c0 3.7-3.2 6.5-8 10.2L12 20.5Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    ) : (
      <svg {...common}>
        <path d="M12 20.5c-4.8-3.7-8-6.5-8-10.2C4 7.1 6.4 5 9.1 5c1.6 0 3 .8 3.9 2.1C13.9 5.8 15.3 5 16.9 5 19.6 5 22 7.1 22 10.3c0 3.7-3.2 6.5-8 10.2L12 20.5Z" />
      </svg>
    );
  }

  if (name === "cart") {
    return (
      <svg {...common}>
        <circle cx="9" cy="19" r="1.4" />
        <circle cx="18" cy="19" r="1.4" />
        <path d="M3.5 4.5h2l1.7 9.4h11.1l1.7-6.7H7.1" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg {...common}>
        <path d="M8 17h8" />
        <path d="M18 17V11a6 6 0 1 0-12 0v6l-1.6 2.2h15.2L18 17Z" />
      </svg>
    );
  }

  if (name === "compare") {
    return (
      <svg {...common}>
        <path d="M5 6h6v12H5z" />
        <path d="M13 6h6v12h-6z" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.2 4.2" />
      </svg>
    );
  }

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6.5 9.8V20h11V9.8" />
      </svg>
    );
  }

  if (name === "plus-square") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  if (name === "message-square") {
    return (
      <svg {...common}>
        <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5Z" />
      </svg>
    );
  }

  if (name === "user") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8.2" r="3.2" />
        <path d="M5.5 19c1.5-2.8 4.1-4.2 6.5-4.2s5 1.4 6.5 4.2" />
      </svg>
    );
  }

  if (name === "menu") {
    return (
      <svg {...common}>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg {...common}>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg {...common}>
        <path d="M5 7h14" />
        <path d="M9 4h6" />
        <path d="M8 7v11" />
        <path d="M16 7v11" />
        <path d="M6.5 7 7 19a2 2 0 0 0 2 1.9h6a2 2 0 0 0 2-1.9L17.5 7" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m6 12 4 4 8-8" />
      </svg>
    );
  }

  if (name === "check-double") {
    return (
      <svg {...common}>
        <path d="m3.5 12 3 3 5-5" />
        <path d="m9 12 3 3 8-8" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg {...common}>
        <path d="M7 4v3" />
        <path d="M17 4v3" />
        <rect x="4" y="6" width="16" height="14" rx="3" />
        <path d="M4 10h16" />
      </svg>
    );
  }

  if (name === "chevron-down") {
    return (
      <svg {...common}>
        <path d="m7 10 5 5 5-5" />
      </svg>
    );
  }

  return null;
}

export function Spinner({ className = "" }) {
  return <span className={`v2-spinner ${className}`.trim()} aria-hidden="true" />;
}

export function Button({
  href,
  children,
  variant = "primary",
  block = false,
  disabled = false,
  loading = false,
  type = "button",
  className = "",
  ...props
}) {
  const classes = [`v2-button`, `v2-button-${variant}`, block ? "v2-button-block" : "", loading ? "v2-button-loading" : "", className].filter(Boolean).join(" ");
  const content = (
    <>
      {loading ? <Spinner className="v2-button-spinner" /> : null}
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
}

export function IconButton({
  href,
  icon,
  label,
  variant = "soft",
  active = false,
  badge = "",
  className = "",
  ...props
}) {
  const classes = [
    "v2-icon-button",
    `v2-icon-button-${variant}`,
    active ? "v2-icon-button-active" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <Icon name={icon} filled={active && icon === "heart"} />
      <span className="v2-sr-only">{label}</span>
      {badge ? <span className="v2-icon-button-badge">{badge}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={label} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} aria-label={label} {...props}>
      {content}
    </button>
  );
}

export function StatusPill({ tone = "neutral", children }) {
  return <span className={`v2-status-pill v2-status-pill-${tone}`}>{children}</span>;
}

export function NoticeBanner({ tone = "neutral", title, description, action, className = "" }) {
  if (!title && !description && !action) return null;

  return (
    <div className={`v2-notice v2-notice-${tone} ${className}`.trim()}>
      <div className="v2-notice-copy">
        {title ? <strong>{title}</strong> : null}
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="v2-notice-action">{action}</div> : null}
    </div>
  );
}

export function Surface({ title, description, actions, children, className = "" }) {
  return (
    <section className={`v2-surface ${className}`.trim()}>
      {(title || description || actions) ? (
        <header className="v2-surface-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="v2-surface-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function MetricTile({ label, value, detail, tone = "neutral", href }) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </>
  );

  if (href) {
    return <Link href={href} className={`v2-metric-tile v2-metric-tile-${tone} v2-metric-tile-link`}>{content}</Link>;
  }

  return <article className={`v2-metric-tile v2-metric-tile-${tone}`}>{content}</article>;
}

export function InlineList({ items = [] }) {
  return (
    <div className="v2-inline-list">
      {items.map((item) => (
        <div key={item.title} className="v2-inline-row">
          <div>
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </div>
          {item.meta ? <small>{item.meta}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function Checklist({ items = [] }) {
  return (
    <div className="v2-checklist">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, compact = false }) {
  return (
    <section className={`v2-page-header ${compact ? "v2-page-header-compact" : ""}`}>
      <div className="v2-page-header-copy">
        {eyebrow ? <p className="v2-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="v2-page-header-actions">{actions}</div> : null}
    </section>
  );
}

export function EmptyBlock({ title, description, action }) {
  return (
    <div className="v2-empty-block">
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div className="v2-empty-block-action">{action}</div> : null}
    </div>
  );
}
