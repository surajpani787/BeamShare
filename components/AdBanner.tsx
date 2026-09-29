'use client';

import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  slot?: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  responsive?: boolean;
  className?: string;
  type: 'header-banner' | 'sidebar' | 'footer-banner';
}

export const AdBanner: React.FC<AdBannerProps> = ({
  slot = '1234567890',
  format = 'auto',
  responsive = true,
  className = '',
  type
}) => {
  const adRef = useRef<HTMLModElement>(null);
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  useEffect(() => {
    if (typeof window !== 'undefined' && adsenseClientId) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error('AdSense push error:', e);
      }
    }
  }, [adsenseClientId]);

  // If no AdSense Client ID is configured, do NOT render any dummy data or placeholders
  if (!adsenseClientId) {
    return null;
  }

  const getContainerStyle = () => {
    switch (type) {
      case 'header-banner':
      case 'footer-banner':
        return 'w-full min-h-[90px] flex items-center justify-center my-2 overflow-hidden';
      case 'sidebar':
        return 'w-full min-h-[250px] flex items-center justify-center my-3 overflow-hidden';
      default:
        return 'w-full min-h-[90px] flex items-center justify-center my-2 overflow-hidden';
    }
  };

  return (
    <div className={`${getContainerStyle()} ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={adsenseClientId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
};
