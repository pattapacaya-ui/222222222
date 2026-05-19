interface LogoProps {
  size?: number
  className?: string
  showText?: boolean
}

export default function Logo({ size = 32, className = '', showText = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path
          d="M32 4L8 14V32C8 46.4 18.8 59.8 32 62C45.2 59.8 56 46.4 56 32V14L32 4Z"
          fill="url(#shieldGrad)"
        />
        <text
          x="22"
          y="44"
          fontFamily="Arial, sans-serif"
          fontSize="28"
          fontWeight="700"
          fontStyle="italic"
          fill="white"
        >
          L
        </text>
      </svg>
      {showText && (
        <span
          className="font-bold text-white"
          style={{ fontSize: size * 0.6, letterSpacing: '-0.02em' }}
        >
          LegionAuth
        </span>
      )}
    </div>
  )
}
