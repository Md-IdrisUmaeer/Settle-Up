const VARIANTS = {
  primary:
    'bg-clay text-cream hover:bg-clay-dark disabled:bg-clay/50',
  secondary:
    'bg-transparent text-ink border border-sage-dark hover:bg-olive disabled:opacity-50',
};

export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  disabled = false,
  loading = false,
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium
        transition-colors duration-150 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? 'One moment…' : children}
    </button>
  );
}
