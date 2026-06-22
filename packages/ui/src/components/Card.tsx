import * as React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", hoverEffect = false, children, ...props }, ref) => {
    const baseStyle = "bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 transition-all duration-300";
    const hoverStyle = hoverEffect ? "hover:border-indigo-500/40 hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-0.5" : "";

    return (
      <div
        ref={ref}
        className={`${baseStyle} ${hoverStyle} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
