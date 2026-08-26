import React from 'react';

const SIZES = {
  sm: 'px-3.5 py-2 text-xs',
  md: 'px-5 py-3 text-sm',
  lg: 'px-6 py-3.5 text-sm',
};

/**
 * Shared button. variant: 'primary' (gradient brand) | 'secondary' (outline)
 * | 'ghost' (text-only). Renders a <button> unless `as="a"` is passed.
 */
export default function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  className = '',
  children,
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-bold whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none';
  const variantClass = {
    primary: 'btn-primary-premium',
    secondary: 'btn-secondary-premium',
    ghost: 'text-[#7C3AED] hover:bg-[#F5F3FF] rounded-xl transition-colors',
  }[variant];

  return (
    <Tag className={`${base} ${variantClass} ${SIZES[size]} ${className}`} {...props}>
      {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
      {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : 16} />}
    </Tag>
  );
}
