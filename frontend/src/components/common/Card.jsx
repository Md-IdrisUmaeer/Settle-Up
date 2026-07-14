export default function Card({ children, className = '' }) {
  return (
    <div className={`rounded-lg border border-sand bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
