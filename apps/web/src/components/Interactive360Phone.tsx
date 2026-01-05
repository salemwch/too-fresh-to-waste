'use client';

import { memo } from 'react';

interface Interactive360PhoneProps {
  currentFrame?: number;
  framesFolder?: string;
  className?: string;
}

const Interactive360Phone = memo(function Interactive360Phone({
  currentFrame = 0,
  framesFolder = 'welcome-frames',
  className = '',
}: Interactive360PhoneProps) {
  // Format frame number with leading zeros (000000, 000001, etc.)
  const frameUrl = `/frames/${framesFolder}/frame_${currentFrame.toString().padStart(6, '0')}.png`;

  return (
    <div className={`select-none ${className}`}>
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Using native img instead of Next Image for smoother rapid frame changes */}
        <img
          src={frameUrl}
          alt="Phone 360° view"
          className="select-none pointer-events-none object-contain scale-[2.5] md:scale-150"
          draggable={false}
          style={{
            width: '100%',
            height: 'auto',
          }}
        />
      </div>
    </div>
  );
});

export default Interactive360Phone;
