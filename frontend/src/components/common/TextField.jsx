export default function TextField({ label, id, error, className = '', ...rest }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-md border border-sage bg-white px-3.5 py-2.5 text-sm text-ink
          placeholder:text-ink-muted/60
          focus:border-clay-dark focus:outline-none"
        {...rest}
      />
      {error && <p className="mt-1.5 text-sm text-debt">{error}</p>}
    </div>
  );
}
