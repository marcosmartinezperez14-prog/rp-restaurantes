import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 19,
          background: '#2F54EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 800,
          fontSize: 36,
          fontFamily: 'sans-serif',
          letterSpacing: '-1px',
        }}
      >
        G
      </div>
    ),
    { ...size }
  )
}
