import React from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  title?: string;
}

export const Button: React.FC<ButtonProps> = ({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  icon,
  children, 
  title,
  disabled,
  onClick,
  ...props 
}) => {
  const variants = {
    primary: 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20',
    secondary: 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-200',
    ghost: 'bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
    danger: 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      className={clsx(
        'group relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
        !disabled && 'active:scale-95',
        disabled && 'opacity-50 cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      onClick={handleClick}
      aria-disabled={disabled}
      type="button"
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      
      {title && (
        <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
          {title}
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900 dark:border-b-slate-100"></span>
        </span>
      )}
    </button>
  );
};