import React from 'react';

const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;

export const renderMessageText = (text = '') => {
  const parts = text.split(URL_PATTERN);

  return parts.map((part, index) => {
    if (part.match(URL_PATTERN)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          style={{
            color: 'inherit',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          {part}
        </a>
      );
    }

    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
};
