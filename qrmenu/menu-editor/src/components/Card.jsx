function Card({ children, className = "", ...props }) {
  return (
    <div 
      className={`bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow rounded-lg border border-gray-100 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card; 