import React from 'react';

const Logo = ({ size = 40, className = "" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="larvaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#00f3ff', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#bc13fe', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Body Segments */}
      <g className="larva-body">
        <circle cx="30" cy="65" r="12" fill="url(#larvaGradient)" filter="url(#glow)">
          <animate attributeName="cy" values="65;60;65" dur="2s" repeatCount="indefinite" begin="0.4s" />
        </circle>
        <circle cx="45" cy="60" r="14" fill="url(#larvaGradient)" filter="url(#glow)">
          <animate attributeName="cy" values="60;55;60" dur="2s" repeatCount="indefinite" begin="0.2s" />
        </circle>
        <circle cx="62" cy="55" r="16" fill="url(#larvaGradient)" filter="url(#glow)">
          <animate attributeName="cy" values="55;50;55" dur="2s" repeatCount="indefinite" begin="0s" />
        </circle>
        
        {/* Head */}
        <circle cx="78" cy="45" r="18" fill="url(#larvaGradient)" filter="url(#glow)">
          <animate attributeName="cy" values="45;40;45" dur="2s" repeatCount="indefinite" begin="-0.2s" />
        </circle>

        {/* Eyes */}
        <g>
          <circle cx="73" cy="42" r="3" fill="white">
            <animate attributeName="cy" values="42;37;42" dur="2s" repeatCount="indefinite" begin="-0.2s" />
          </circle>
          <circle cx="83" cy="42" r="3" fill="white">
            <animate attributeName="cy" values="42;37;42" dur="2s" repeatCount="indefinite" begin="-0.2s" />
          </circle>
          <circle cx="73" cy="42" r="1.5" fill="black">
            <animate attributeName="cy" values="42;37;42" dur="2s" repeatCount="indefinite" begin="-0.2s" />
          </circle>
          <circle cx="83" cy="42" r="1.5" fill="black">
            <animate attributeName="cy" values="42;37;42" dur="2s" repeatCount="indefinite" begin="-0.2s" />
          </circle>
        </g>

        {/* Antennae */}
        <path d="M75 30 Q 70 20 65 22" stroke="var(--primary-color)" strokeWidth="2" fill="none">
          <animate attributeName="d" values="M75 30 Q 70 20 65 22;M75 25 Q 70 15 65 17;M75 30 Q 70 20 65 22" dur="2s" repeatCount="indefinite" begin="-0.2s" />
        </path>
        <path d="M81 30 Q 86 20 91 22" stroke="var(--secondary-color)" strokeWidth="2" fill="none">
           <animate attributeName="d" values="M81 30 Q 86 20 91 22;M81 25 Q 86 15 91 17;M81 30 Q 86 20 91 22" dur="2s" repeatCount="indefinite" begin="-0.2s" />
        </path>
      </g>
    </svg>
  );
};

export default Logo;
