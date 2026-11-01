export default function Icon({ name, size = 20, className = '', 'aria-label': ariaLabel, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      aria-hidden={ariaLabel ? undefined : 'true'}
      aria-label={ariaLabel}
      focusable="false"
      className={`icon ${className}`.trim()}
      {...props}
    >
      <use href={`/icons.svg#${name}`} />
    </svg>
  )
}
