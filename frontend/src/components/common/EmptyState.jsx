import Card from './Card';

const ICONS = {
  groups: (
    <path
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 20a2 2 0 0 0 2-2v-1a4 4 0 0 0-3-3.87M9 20H4v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1H9Zm2-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 0a3 3 0 1 0 0-6"
    />
  ),
  activity: (
    <path
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 12h4l2-7 4 14 2-7h6"
    />
  ),
  settled: (
    <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
  ),
  members: (
    <path
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 3.13a4 4 0 0 1 0 7.75M15.5 3.13a4 4 0 0 1 0 7.75"
    />
  ),
};

/**
 * Consistent empty-state pattern: icon, one-line message, optional helper
 * text and call-to-action. Used anywhere a list/collection can be empty
 * (no groups, no activity, no debts, no members beyond yourself).
 */
export default function EmptyState({ icon = 'groups', title, description, action, className = '' }) {
  return (
    <Card className={`flex flex-col items-center gap-3 py-10 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-olive text-sage-dark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
          {ICONS[icon] || ICONS.groups}
        </svg>
      </div>
      <div>
        <p className="font-medium text-ink">{title}</p>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </Card>
  );
}
