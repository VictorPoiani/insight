import { ImageResponse } from 'next/og';

export const size = {
  width: 64,
  height: 64,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
          borderRadius: '16px',
          border: '2px solid #27272a',
          fontSize: 38,
          fontWeight: 900,
          color: '#f4f4f5',
        }}
      >
        I<span style={{ color: '#2563eb' }}>*</span>
      </div>
    ),
    { ...size }
  );
}